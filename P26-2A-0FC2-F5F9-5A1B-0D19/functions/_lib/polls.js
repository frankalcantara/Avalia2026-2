// Regras de negócio das enquetes: funções puras (sem D1, sem rede), fáceis de testar.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19

const MIN_AHEAD = 5 * 60 * 1000;          // prazo mínimo: 5 minutos no futuro
const MAX_AHEAD = 365 * 24 * 60 * 60 * 1000; // prazo máximo: 365 dias

const fail = (message) => ({ ok: false, message });

// Valida o corpo de POST /api/polls contra o relógio do servidor (now, epoch ms).
// Retorna { ok:true, value:{ title, description, closesAt, options } } ou { ok:false, message }.
export function validatePollInput(body, now) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Corpo da requisição inválido.");

  // Título: texto, 3 a 120 caracteres após trim.
  if (typeof body.title !== "string") return fail("title: informe um texto.");
  const title = body.title.trim();
  if (title.length < 3 || title.length > 120) return fail("title: deve ter entre 3 e 120 caracteres.");

  // Descrição: opcional, texto de 0 a 1000 caracteres (após trim).
  const rawDesc = body.description ?? "";
  if (typeof rawDesc !== "string") return fail("description: informe um texto.");
  const description = rawDesc.trim();
  if (description.length > 1000) return fail("description: máximo de 1000 caracteres.");

  // Prazo: data ISO 8601 válida, entre now+5min e now+365d.
  if (typeof body.closes_at !== "string" || !body.closes_at.trim()) return fail("closes_at: informe uma data ISO 8601.");
  const closesAt = Date.parse(body.closes_at);
  if (!Number.isFinite(closesAt)) return fail("closes_at: data inválida.");
  if (closesAt < now + MIN_AHEAD) return fail("closes_at: o prazo deve ser de pelo menos 5 minutos no futuro.");
  if (closesAt > now + MAX_AHEAD) return fail("closes_at: o prazo máximo é de 365 dias.");

  // Opções: 2 a 10 textos de 1 a 100 caracteres, sem repetição (ignora maiúsculas).
  if (!Array.isArray(body.options)) return fail("options: envie uma lista de opções.");
  if (body.options.length < 2 || body.options.length > 10) return fail("options: informe de 2 a 10 opções.");
  const options = [];
  const seen = new Set();
  for (let i = 0; i < body.options.length; i++) {
    const o = body.options[i];
    if (typeof o !== "string") return fail(`options: a opção ${i + 1} deve ser um texto.`);
    const label = o.trim();
    if (label.length < 1 || label.length > 100) return fail(`options: a opção ${i + 1} deve ter entre 1 e 100 caracteres.`);
    const key = label.toLowerCase();
    if (seen.has(key)) return fail(`options: a opção "${label}" está repetida.`);
    seen.add(key);
    options.push(label);
  }

  return { ok: true, value: { title, description, closesAt, options } };
}

// Monta os resultados a partir das opções [{id,label}] e da contagem de votos.
// counts pode ser um Map/objeto { option_id: votos } ou uma lista [{ option_id, votes }].
// Percentual com 1 casa decimal; 0 quando não há votos.
export function buildResults(options, counts) {
  const map = new Map();
  if (Array.isArray(counts)) {
    for (const c of counts) map.set(Number(c.option_id), Number(c.votes) || 0);
  } else if (counts instanceof Map) {
    for (const [k, v] of counts) map.set(Number(k), Number(v) || 0);
  } else if (counts && typeof counts === "object") {
    for (const k of Object.keys(counts)) map.set(Number(k), Number(counts[k]) || 0);
  }
  const rows = (options || []).map((o) => ({ id: o.id, label: o.label, votes: map.get(Number(o.id)) || 0 }));
  const total = rows.reduce((s, r) => s + r.votes, 0);
  return {
    total_votes: total,
    options: rows.map((r) => ({ ...r, percent: total ? Math.round((r.votes * 1000) / total) / 10 : 0 })),
  };
}
