/**
 * Utilitários das rotas de coleções, links e coleção pública:
 * wrapper de rota (método → banco → autenticação → tratamento de erros),
 * leitura de JSON, validadores do checklist e consultas/serialização de coleções.
 * Não é uma rota (não exporta onRequest*).
 */
import { getUser, avatarUrl } from "./auth.js";
import { json, methodNotAllowed } from "./http.js";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const STATUSES = ["Para Ler", "Lendo", "Concluído"];
export const LIMITS = { url: 2048, title: 200, summary: 1000, name: 80, description: 500, body: 16384 };
// Slug público: 16 bytes aleatórios em base64url = 22 caracteres.
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const LINK_COLUMNS = "id, collection_id, url, title, summary, status, created_at, updated_at";

/**
 * Monta o onRequest de uma rota. `handlers` mapeia método → função.
 * Ordem: método (405) → binding DB (500) → getUser() (401, se auth) → handler.
 * ApiError vira JSON com o status dela; qualquer outro erro vira 500 genérico, sem detalhes.
 */
export function route(handlers, { auth = true } = {}) {
  const allowed = Object.keys(handlers).join(", ");
  return async function onRequest(context) {
    const { request, env } = context;
    const handler = Object.hasOwn(handlers, request.method) ? handlers[request.method] : null;
    if (!handler) return methodNotAllowed(allowed);

    try {
      if (!env.DB) throw new ApiError(500, "Banco de dados não configurado");
      let user = null;
      if (auth) {
        user = await getUser(request, env);
        if (!user) throw new ApiError(401, "Não autenticado");
      }
      return await handler({ request, env, params: context.params || {}, user, url: new URL(request.url) });
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status);
      console.error("Erro não tratado:", err && err.message);
      return json({ error: "Erro interno" }, 500);
    }
  };
}

/** Lê o corpo como JSON; precisa ser um objeto. Inválido → 400; grande demais → 413. */
export async function readJson(request) {
  let text;
  try {
    text = await request.text();
  } catch {
    throw new ApiError(400, "JSON inválido");
  }
  if (text.length > LIMITS.body) throw new ApiError(413, "Corpo da requisição muito grande");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "JSON inválido");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "O corpo deve ser um objeto JSON");
  }
  return body;
}

/** Inteiro positivo (número ou texto só com dígitos) ou null. */
export function parseId(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value === "string" && /^[1-9]\d{0,14}$/.test(value)) return Number(value);
  return null;
}

export function requireId(raw) {
  const id = parseId(raw);
  if (id === null) throw new ApiError(400, "ID inválido");
  return id;
}

// .length do JS conta unidades UTF-16 (>= length() do SQLite), então nunca passa algo que o CHECK do banco rejeite.
function cleanText(value, label, min, max) {
  if (value === undefined) throw new ApiError(400, `${label} é obrigatório`);
  if (typeof value !== "string") throw new ApiError(400, `${label} deve ser um texto`);
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw new ApiError(400, min === 0 ? `${label} deve ter até ${max} caracteres` : `${label} deve ter de ${min} a ${max} caracteres`);
  }
  return text;
}

export const validateName = (v) => cleanText(v, "Nome", 1, LIMITS.name);
export const validateDescription = (v) => cleanText(v, "Descrição", 0, LIMITS.description);
export const validateTitle = (v) => cleanText(v, "Título", 1, LIMITS.title);
export const validateSummary = (v) => cleanText(v, "Resumo", 0, LIMITS.summary);

/** Só http: ou https:, validada com new URL(). Devolve a forma normalizada (parsed.href). */
export function validateUrl(value) {
  if (typeof value !== "string") throw new ApiError(400, "URL inválida");
  const raw = value.trim();
  if (!raw) throw new ApiError(400, "URL inválida");
  if (raw.length > LIMITS.url) throw new ApiError(400, `URL deve ter no máximo ${LIMITS.url} caracteres`);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ApiError(400, "URL inválida");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new ApiError(400, "URL inválida");
  if (parsed.href.length > LIMITS.url) throw new ApiError(400, `URL deve ter no máximo ${LIMITS.url} caracteres`);
  return parsed.href;
}

export function validateStatus(value) {
  const status = typeof value === "string" ? value.normalize("NFC") : value;
  if (!STATUSES.includes(status)) throw new ApiError(400, "Status inválido. Use: Para Ler, Lendo ou Concluído");
  return status;
}

export function validateCollectionId(value) {
  if (value === undefined) throw new ApiError(400, "collection_id é obrigatório");
  const id = parseId(value);
  if (id === null) throw new ApiError(400, "collection_id inválido");
  return id;
}

/** A coleção precisa existir E pertencer ao usuário da sessão; senão 404 (não revela se é de outro usuário). */
export async function requireOwnedCollection(env, userId, collectionId) {
  const row = await env.DB.prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?")
    .bind(collectionId, userId)
    .first();
  if (!row) throw new ApiError(404, "Coleção não encontrada");
}

export function isUniqueViolation(err) {
  return /UNIQUE constraint failed/i.test(String((err && err.message) || ""));
}

const COLLECTION_SELECT =
  "SELECT c.id, c.name, c.description, c.is_public, c.public_slug, c.created_at, " +
  "(SELECT COUNT(*) FROM links l WHERE l.collection_id = c.id) AS link_count " +
  "FROM collections c WHERE c.user_id = ?";

export async function listCollections(env, userId) {
  const { results } = await env.DB.prepare(`${COLLECTION_SELECT} ORDER BY c.name COLLATE NOCASE, c.id`)
    .bind(userId)
    .all();
  return results.map(serializeCollection);
}

export async function fetchCollection(env, userId, id) {
  const row = await env.DB.prepare(`${COLLECTION_SELECT} AND c.id = ?`).bind(userId, id).first();
  return row ? serializeCollection(row) : null;
}

export function serializeCollection(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    is_public: row.is_public === 1,
    public_slug: row.public_slug ?? null,
    link_count: row.link_count,
    created_at: row.created_at,
  };
}

/** Slug aleatório e URL-safe: 16 bytes (crypto.getRandomValues) em base64url, sem padding. */
export function randomSlug() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export { avatarUrl };