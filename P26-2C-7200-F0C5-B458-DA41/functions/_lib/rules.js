/**
 * Regras de negócio do Issue Tracker (puras, sem I/O).
 * Usadas pelas Cloudflare Pages Functions e pelos testes automatizados (node --test).
 * Nada aqui confia no cliente: todo dado recebido é revalidado.
 */

export const CHAVE_UNICA = "P26-2C-7200-F0C5-B458-DA41";

export const STATUSES = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  aguardando: "Aguardando Peça/Correção",
  resolvido: "Resolvido",
};

export const SEVERITIES = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

/** Máquina de estados: de onde se pode ir para onde. "resolvido" é final (chamado fechado). */
export const TRANSITIONS = {
  aberto: ["em_analise", "resolvido"],
  em_analise: ["aguardando", "resolvido"],
  aguardando: ["em_analise", "resolvido"],
  resolvido: [],
};

export const LIMITS = {
  title: [5, 120],
  location: [2, 80],
  description: [10, 4000],
  comment: [2, 2000],
  statusNote: [0, 1000],
};

/** Remove caracteres de controle (exceto quebra de linha e tab) e espaços nas pontas. */
export function cleanText(value, { multiline = false } = {}) {
  if (typeof value !== "string") return "";
  let s = value.normalize("NFC");
  s = multiline
    ? s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    : s.replace(/[\u0000-\u001F\u007F]+/g, " ");
  return s.trim();
}

function checkLength(errors, field, value, [min, max], label) {
  const len = [...value].length;
  if (len < min) errors[field] = min <= 1 ? `${label} é obrigatório.` : `${label} precisa ter pelo menos ${min} caracteres.`;
  else if (len > max) errors[field] = `${label} pode ter no máximo ${max} caracteres.`;
}

/** Valida o payload de abertura de chamado. Retorna { ok, data } ou { ok:false, errors }. */
export function validateTicketInput(body) {
  const src = body && typeof body === "object" ? body : {};
  const data = {
    title: cleanText(src.title),
    location: cleanText(src.location),
    severity: typeof src.severity === "string" ? src.severity.trim().toLowerCase() : "",
    description: cleanText(src.description, { multiline: true }),
  };
  const errors = {};
  checkLength(errors, "title", data.title, LIMITS.title, "Título");
  checkLength(errors, "location", data.location, LIMITS.location, "Laboratório/projeto afetado");
  checkLength(errors, "description", data.description, LIMITS.description, "Descrição");
  if (!Object.hasOwn(SEVERITIES, data.severity)) {
    errors.severity = `Severidade inválida. Use: ${Object.keys(SEVERITIES).join(", ")}.`;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** Valida um comentário técnico. */
export function validateComment(body) {
  const text = cleanText(body && body.body, { multiline: true });
  const errors = {};
  checkLength(errors, "body", text, LIMITS.comment, "Comentário");
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: { body: text } };
}

/** Valida o payload de mudança de estado (formato apenas; permissão é checada em canChangeStatus). */
export function validateStatusChange(body) {
  const src = body && typeof body === "object" ? body : {};
  const to = typeof src.status === "string" ? src.status.trim() : "";
  const note = cleanText(src.note, { multiline: true });
  const errors = {};
  if (!Object.hasOwn(STATUSES, to)) errors.status = "Estado de destino inválido.";
  checkLength(errors, "note", note, LIMITS.statusNote, "Observação");
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: { status: to, note } };
}

export function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

export function isClosed(status) {
  return status === "resolvido";
}

/** Lista de IDs do Discord com papel de técnico/administrador (variável ADMIN_DISCORD_IDS). */
export function parseAdminIds(raw) {
  return new Set(
    String(raw || "")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{5,25}$/.test(s))
  );
}

export function isAdmin(env, userId) {
  return parseAdminIds(env && env.ADMIN_DISCORD_IDS).has(String(userId));
}

/**
 * Quem pode mudar o estado:
 *  - técnicos/administradores: qualquer transição válida;
 *  - autor do chamado: apenas marcar como "Resolvido" (ex.: o problema sumiu sozinho).
 * Retorna { ok:true } ou { ok:false, status, error }.
 */
export function canChangeStatus({ userId, admin, ticket, to }) {
  if (!canTransition(ticket.status, to)) {
    return {
      ok: false,
      status: 409,
      error: isClosed(ticket.status)
        ? "Chamado já está resolvido (fechado) e não aceita mudanças."
        : `Transição inválida: ${STATUSES[ticket.status] || ticket.status} → ${STATUSES[to] || to}.`,
    };
  }
  if (admin) return { ok: true };
  if (ticket.author_id === String(userId) && to === "resolvido") return { ok: true };
  return { ok: false, status: 403, error: "Somente técnicos (ADMIN_DISCORD_IDS) podem mover este chamado; o autor pode apenas marcá-lo como resolvido." };
}

/** Transições que a interface deve oferecer a este usuário (espelho de canChangeStatus). */
export function allowedTransitionsFor({ userId, admin, ticket }) {
  return (TRANSITIONS[ticket.status] || []).filter((to) => canChangeStatus({ userId, admin, ticket, to }).ok);
}

// Alfabeto Crockford Base32 (sem I, L, O, U) — fácil de ditar no laboratório
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Gera o código público do chamado, ex.: CH-7K2M9Q. `randomBytes(n)` deve devolver Uint8Array. */
export function generateTicketCode(randomBytes) {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] & 31];
  return `CH-${out}`;
}

export const TICKET_CODE_REGEX = /^CH-[0-9A-HJKMNP-TV-Z]{6}$/;

export function normalizeTicketCode(raw) {
  const code = String(raw || "").trim().toUpperCase();
  return TICKET_CODE_REGEX.test(code) ? code : null;
}

/** Filtros da listagem (?status=&severity=&q=&mine=1). Ignora valores desconhecidos. */
export function parseListFilters(searchParams) {
  const get = (k) => (searchParams.get(k) || "").trim();
  const status = get("status");
  const severity = get("severity");
  const q = cleanText(get("q")).slice(0, 80);
  return {
    status: Object.hasOwn(STATUSES, status) ? status : null,
    severity: Object.hasOwn(SEVERITIES, severity) ? severity : null,
    q: q || null,
    mine: get("mine") === "1",
  };
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}
