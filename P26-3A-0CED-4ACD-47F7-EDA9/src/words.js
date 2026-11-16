// Sorteio da palavra diária: embaralhamento secreto por ciclo, sem repetição
import { LAUNCH_DATE, MODES, RECENT_SLOTS_BLOCK } from "./config.js";
import { addDays, daysBetween } from "./dates.js";
import { answerKeys } from "./dictionary.js";
import { HttpError } from "./http.js";

// Semente de 128 bits derivada de HMAC-SHA256(WORD_SECRET, "ciclo:N")
async function cycleSeed(secret, cycle) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`ciclo:${cycle}`));
  return new Uint32Array(sig.slice(0, 16));
}

// Gerador sfc32 (determinístico a partir da semente)
function sfc32([a, b, c, d]) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

async function cycleOrder(secret, cycle, cache) {
  if (!cache.has(cycle)) {
    const rand = sfc32(await cycleSeed(secret, cycle));
    const order = [...answerKeys()].sort();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    cache.set(cycle, order);
  }
  return cache.get(cycle);
}

export function slotFor(mode, date) {
  return 2 * daysBetween(LAUNCH_DATE, date) + MODES[mode].offset;
}

// Preenche os slots faltantes em ordem até o alvo (nunca além dele)
async function materialize(env, target) {
  const { results } = await env.DB.prepare("SELECT slot, word_key, cycle FROM daily_words ORDER BY slot").all();
  const existing = new Map(results.map((r) => [r.slot, r]));
  const total = answerKeys().length;
  const orders = new Map();
  const usedByCycle = new Map();
  const history = [];
  const inserts = [];
  let cycle = 0;

  for (let slot = 0; slot <= target; slot++) {
    let row = existing.get(slot);
    if (!row) {
      let used = usedByCycle.get(cycle) || new Set();
      if (used.size >= total) {
        cycle++;
        used = new Set();
      }
      const recent = new Set(history.slice(-RECENT_SLOTS_BLOCK));
      const order = await cycleOrder(env.WORD_SECRET, cycle, orders);
      const pick = order.find((k) => !used.has(k) && !recent.has(k)) || order.find((k) => !used.has(k)) || order[0];
      row = { slot, word_key: pick, cycle };
      inserts.push(row);
    }
    cycle = row.cycle;
    if (!usedByCycle.has(cycle)) usedByCycle.set(cycle, new Set());
    usedByCycle.get(cycle).add(row.word_key);
    history.push(row.word_key);
  }

  if (inserts.length) {
    const stmt = env.DB.prepare(
      "INSERT OR IGNORE INTO daily_words (slot, mode, day, word_key, cycle) VALUES (?, ?, ?, ?, ?)"
    );
    await env.DB.batch(
      inserts.map((r) =>
        stmt.bind(r.slot, r.slot % 2 === 0 ? "classico" : "sombra", addDays(LAUNCH_DATE, Math.floor(r.slot / 2)), r.word_key, r.cycle)
      )
    );
  }
}

// Retorna a chave normalizada da palavra do modo/dia (data já validada: <= hoje)
export async function getDailyWord(env, mode, date) {
  const slot = slotFor(mode, date);
  const find = () => env.DB.prepare("SELECT word_key FROM daily_words WHERE slot = ?").bind(slot).first();
  let row = await find();
  if (row) return row.word_key;
  if (!env.WORD_SECRET) throw new HttpError(500, "server_misconfigured", "WORD_SECRET não configurado no servidor.");
  await materialize(env, slot);
  row = await find();
  if (!row) throw new HttpError(500, "server_misconfigured", "Não foi possível sortear a palavra do dia.");
  return row.word_key;
}
