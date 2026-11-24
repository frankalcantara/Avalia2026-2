/**
 * Utilidades HTTP compartilhadas pelas Cloudflare Pages Functions da API.
 * Zero dependências: apenas APIs nativas (Web Standard — Request/Response/Headers).
 *
 * @module functions/api/_lib/http
 */

/** Content-Type canônico de todas as respostas JSON da API. */
export const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** Limite padrão de corpo aceito pela API (32 KiB). */
export const DEFAULT_MAX_BODY_BYTES = 32768;

/**
 * Erro de requisição com código estável e status HTTP associado.
 * Usado por `readJson` para que os handlers traduzam falhas em respostas JSON.
 */
export class RequestError extends Error {
  /**
   * @param {string} code Código legível por máquina (ex.: "invalid_json").
   * @param {string} message Mensagem em português para o cliente.
   * @param {number} [status=400] Status HTTP correspondente.
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = "RequestError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Serializa um objeto em resposta JSON.
 *
 * @param {unknown} data Corpo da resposta (será serializado).
 * @param {number} [status=200] Status HTTP.
 * @param {Record<string, string> | Headers} [extraHeaders] Headers adicionais.
 * @returns {Response} Resposta pronta para retorno.
 */
export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", JSON_CONTENT_TYPE);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Resposta de erro padronizada: `{ ok:false, error:{ code, message } }`.
 *
 * @param {number} status Status HTTP.
 * @param {string} code Código de erro estável.
 * @param {string} message Mensagem legível em português.
 * @param {Record<string, unknown>} [extra] Campos extras no nível raiz (ex.: `details`).
 * @returns {Response} Resposta JSON de erro.
 */
export function fail(status, code, message, extra = {}) {
  return json({ ok: false, error: { code, message }, ...extra }, status);
}

/**
 * Redirecionamento 302 sem corpo.
 *
 * @param {string} location Destino (absoluto ou relativo).
 * @param {Record<string, string> | Headers} [extraHeaders] Headers adicionais.
 * @returns {Response} Resposta 302.
 */
export function redirect(location, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

/**
 * Lê e valida um corpo JSON com limite de tamanho.
 *
 * Regras: corpo obrigatório, objeto JSON (não array/null), tamanho <= `maxBytes`.
 *
 * @param {Request} request Requisição HTTP.
 * @param {number} [maxBytes] Limite em bytes (default 32 KiB).
 * @returns {Promise<Record<string, unknown>>} Objeto JSON já parseado.
 * @throws {RequestError} Em corpo ausente, inválido, grande demais ou de tipo errado.
 */
export async function readJson(request, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestError("payload_too_large", "Corpo da requisição excede o limite permitido.", 413);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    throw new RequestError("invalid_body", "Não foi possível ler o corpo da requisição.", 400);
  }

  if (raw.length > maxBytes) {
    throw new RequestError("payload_too_large", "Corpo da requisição excede o limite permitido.", 413);
  }
  // `raw.length` conta unidades UTF-16, mas o limite é em bytes: um corpo cheio
  // de caracteres multibyte poderia chegar a ~3x o limite sem Content-Length.
  if (new TextEncoder().encode(raw).length > maxBytes) {
    throw new RequestError("payload_too_large", "Corpo da requisição excede o limite permitido.", 413);
  }
  if (raw.trim().length === 0) {
    throw new RequestError("invalid_json", "Corpo JSON ausente.", 400);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RequestError("invalid_json", "JSON inválido.", 400);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RequestError("invalid_json", "O corpo deve ser um objeto JSON.", 400);
  }

  return /** @type {Record<string, unknown>} */ (parsed);
}

/**
 * Converte um erro desconhecido em resposta JSON segura (sem vazar detalhes).
 *
 * @param {unknown} error Erro capturado.
 * @returns {Response} 4xx para RequestError, 500 para o restante.
 */
export function failFromError(error) {
  if (error instanceof RequestError) {
    return fail(error.status, error.code, error.message);
  }
  return fail(500, "internal_error", "Erro interno ao processar a requisição.");
}

/**
 * Resolve a origem canônica da aplicação (usada no `redirect_uri` do OAuth2).
 *
 * Preferência: `env.PUBLIC_ORIGIN` → 1ª entrada de `env.ALLOWED_ORIGINS` →
 * origem da própria requisição. Fixar a origem evita que o `redirect_uri`
 * varie entre produção, preview e domínios customizados.
 *
 * @param {Record<string, unknown>} env Bindings do Pages Functions.
 * @param {Request | URL | string} request Requisição (ou URL) em uso.
 * @returns {string} Origem absoluta sem barra final.
 */
export function canonicalOrigin(env, request) {
  const strip = (value) => String(value).trim().replace(/\/+$/, "");

  const explicit = typeof env?.PUBLIC_ORIGIN === "string" ? env.PUBLIC_ORIGIN.trim() : "";
  if (explicit) return strip(explicit);

  const allowlist = typeof env?.ALLOWED_ORIGINS === "string" ? env.ALLOWED_ORIGINS : "";
  const firstAllowed = allowlist
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];
  if (firstAllowed) return strip(firstAllowed);

  const href = request instanceof Request ? request.url : String(request);
  return new URL(href).origin;
}

/**
 * Extrai o IP do cliente para rate limiting.
 *
 * @param {Request} request Requisição HTTP.
 * @returns {string} IP ou "unknown".
 */
export function clientIp(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first && first.trim()) return first.trim();
  }

  return "unknown";
}
