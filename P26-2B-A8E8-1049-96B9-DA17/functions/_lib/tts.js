import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "./http.js";
import { getSessionUser } from "./session.js";

export const MAX_TEXT = 1500;
export const GOOGLE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TIMEOUT_MS = 8000;
const VOICE_RE = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]{3,30}$/;
const DEFAULTS = { pt: "pt-BR-Neural2-A", en: "en-US-Neural2-F" };
const MAX_AUDIO_B64 = 4 * 1024 * 1024; // ~3 MB de áudio: muito acima de 1500 caracteres

export const hasTtsKey = (env) => typeof env?.GOOGLE_TTS_API_KEY === "string" && env.GOOGLE_TTS_API_KEY.trim() !== "";

export function normalizeText(v) {
  return v.normalize("NFC").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

export function voiceFor(env, lang) {
  const o = lang === "pt" ? env.TTS_VOICE_PT : env.TTS_VOICE_EN;
  const name = typeof o === "string" && VOICE_RE.test(o.trim()) ? o.trim() : DEFAULTS[lang];
  return { name, languageCode: name.split("-").slice(0, 2).join("-") };
}

const intEnv = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function periodKeys(userId, now = new Date()) {
  const iso = now.toISOString();
  return { month: `m:${iso.slice(0, 7)}`, day: `u:${userId}:${iso.slice(0, 10)}` };
}

/** Reserva n caracteres de forma atômica; true se coube no limite. */
export async function reserve(env, period, n, limit) {
  if (n > limit) return false;
  const r = await env.DB.prepare(
    "INSERT INTO tts_usage (period, chars) VALUES (?, ?) ON CONFLICT(period) DO UPDATE SET chars = chars + ? WHERE chars + ? <= ?"
  ).bind(period, n, n, n, limit).run();
  return (r?.meta?.changes ?? 0) > 0;
}

export async function refund(env, period, n) {
  try {
    await env.DB.prepare("UPDATE tts_usage SET chars = MAX(chars - ?, 0) WHERE period = ?").bind(n, period).run();
  } catch { /* melhor esforço */ }
}

function defaultCache() {
  return typeof caches !== "undefined" ? caches.default : null;
}

const audioResponse = (bytes, hit) =>
  new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "X-TTS-Cache": hit ? "HIT" : "MISS",
    },
  });

const upstreamFail = () => json({ ok: false, error: "Falha ao gerar a voz.", code: "tts_upstream" }, 502);

function validate(body) {
  const fields = {};
  let text = "";
  if (typeof body.text !== "string") fields.text = "O texto é obrigatório.";
  else {
    text = normalizeText(body.text);
    if (!text) fields.text = "O texto é obrigatório.";
    else if ([...text].length > MAX_TEXT) fields.text = `Máximo de ${MAX_TEXT} caracteres.`;
  }
  if (body.lang !== "pt" && body.lang !== "en") fields.lang = "Use 'pt' ou 'en'.";
  let rate = 1;
  if (body.rate !== undefined && body.rate !== null) {
    if (typeof body.rate !== "number" || !Number.isFinite(body.rate) || body.rate < 0.75 || body.rate > 1.5) {
      fields.rate = "Use um valor entre 0.75 e 1.5.";
    } else rate = Math.round(body.rate * 100) / 100;
  }
  return Object.keys(fields).length ? { fields } : { text, lang: body.lang, rate };
}

/** deps: { cache?: {match(req), put(req,res)}, fetchFn?, now? } — injetáveis para teste. */
export async function handleTts({ request, env }, deps = {}) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  const { body, response } = await readJson(request);
  if (response) return response;
  const v = validate(body);
  if (v.fields) return fail(400, "Dados inválidos.", v.fields);
  if (!hasTtsKey(env)) {
    return json({ ok: false, error: "Voz em nuvem não configurada.", code: "tts_unconfigured" }, 503);
  }

  const { text, lang, rate } = v;
  const voice = voiceFor(env, lang);
  const cache = deps.cache === undefined ? defaultCache() : deps.cache;
  const fetchFn = deps.fetchFn || fetch;
  const cacheReq = new Request(`https://tts.cache.invalid/${await sha256Hex(`${lang}|${voice.name}|${rate}|${text}`)}`);

  if (cache) {
    try {
      const hit = await cache.match(cacheReq);
      if (hit) return audioResponse(await hit.arrayBuffer(), true);
    } catch { /* cache indisponível: segue como MISS */ }
  }

  // Cota (só em MISS, antes de chamar o Google).
  const n = [...text].length;
  const { month, day } = periodKeys(user.userId, deps.now);
  const dailyLimit = intEnv(env.TTS_DAILY_USER_CHARS, 30000);
  const monthlyLimit = intEnv(env.TTS_MONTHLY_CHARS, 700000);
  const quota = () =>
    json({ ok: false, error: "Limite de leitura em voz natural atingido; usando a voz do navegador.", code: "tts_quota" }, 429);
  try {
    if (!(await reserve(env, day, n, dailyLimit))) return quota();
    if (!(await reserve(env, month, n, monthlyLimit))) {
      await refund(env, day, n);
      return quota();
    }
  } catch {
    return fail(500, "Erro interno.");
  }
  const giveBack = async () => { await refund(env, day, n); await refund(env, month, n); };

  let bytes;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(GOOGLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_TTS_API_KEY.trim() },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: voice.languageCode, name: voice.name },
        audioConfig: { audioEncoding: "MP3", speakingRate: rate, sampleRateHertz: 24000 },
      }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error("upstream");
    const data = await res.json();
    const b64 = data?.audioContent;
    if (typeof b64 !== "string" || !b64 || b64.length > MAX_AUDIO_B64) throw new Error("bad audio");
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (!bytes.length) throw new Error("empty");
  } catch {
    await giveBack();
    return upstreamFail();
  } finally {
    clearTimeout(timer);
  }

  if (cache) {
    try {
      await cache.put(cacheReq, new Response(bytes, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=2592000" },
      }));
    } catch { /* sem cache: ainda devolve o áudio */ }
  }
  return audioResponse(bytes, false);
}
