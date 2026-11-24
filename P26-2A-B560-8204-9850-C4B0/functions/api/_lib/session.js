/**
 * Sessão stateless assinada com HMAC-SHA256 (Web Crypto — zero dependências).
 *
 * Formato do token: `base64url(payloadJson).base64url(hmacSha256(payloadB64utf8))`
 * Payload: `{ uid, name, avatar, iat, exp }` com `exp = iat + 604800s` (7 dias).
 *
 * O segredo NUNCA tem fallback: sem `env.SESSION_SECRET` válido (>= 32 chars)
 * nenhuma sessão é criada nem aceita.
 *
 * @module functions/api/_lib/session
 */

/** Nome do cookie de sessão. */
export const SESSION_COOKIE = "receitas_session";

/** Nome do cookie temporário do fluxo OAuth2 (proteção CSRF do `state`). */
export const OAUTH_STATE_COOKIE = "oauth_state";

/** Validade da sessão em segundos (7 dias). */
export const SESSION_TTL_SECONDS = 604800;

/** Comprimento mínimo aceitável do segredo HMAC. */
export const SESSION_SECRET_MIN_LENGTH = 32;

/** Tamanho máximo aceito para o token recebido via cookie. */
const MAX_TOKEN_LENGTH = 2048;

/** Cache de chaves HMAC por segredo (evita reimportar em cada request). */
const keyCache = new Map();

/**
 * Informa se o segredo de sessão está configurado corretamente.
 *
 * @param {unknown} secret Valor de `env.SESSION_SECRET`.
 * @returns {boolean} `true` quando existe e tem pelo menos 32 caracteres.
 */
export function isValidSessionSecret(secret) {
  return typeof secret === "string" && secret.length >= SESSION_SECRET_MIN_LENGTH;
}

/* ------------------------------------------------------------------ *
 * Base64URL (RFC 4648 §5) — seguro para Unicode via TextEncoder.
 * ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} bytes Bytes a codificar.
 * @returns {string} String base64url sem padding.
 */
function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * @param {string} value String base64url.
 * @returns {Uint8Array} Bytes decodificados.
 */
function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Importa (e memoiza) a chave HMAC-SHA256 do segredo informado.
 *
 * @param {string} secret Segredo validado.
 * @returns {Promise<CryptoKey>} Chave pronta para sign/verify.
 */
async function getHmacKey(secret) {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  if (keyCache.size >= 4) keyCache.clear();
  keyCache.set(secret, key);
  return key;
}

/**
 * Compara duas strings em tempo constante (evita timing attacks no `state`/assinatura).
 *
 * @param {string} a Primeira string.
 * @param {string} b Segunda string.
 * @returns {boolean} `true` quando idênticas.
 */
export function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Assina um segmento já codificado em base64url.
 *
 * @param {string} segment Segmento base64url (payload).
 * @param {string} secret Segredo HMAC.
 * @returns {Promise<string>} Assinatura em base64url.
 */
async function signSegment(segment, secret) {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(segment));
  return bytesToBase64Url(new Uint8Array(signature));
}

/* ------------------------------------------------------------------ *
 * Token de sessão
 * ------------------------------------------------------------------ */

/**
 * Cria o token de sessão assinado para um usuário autenticado.
 *
 * @param {{ userId: string, username: string, avatar: string }} user Dados do usuário.
 * @param {string} secret Valor de `env.SESSION_SECRET`.
 * @returns {Promise<string>} Token `payload.signature`.
 * @throws {Error} `session_secret_missing` quando o segredo é inválido.
 */
export async function createSession(user, secret) {
  if (!isValidSessionSecret(secret)) {
    throw new Error("session_secret_missing");
  }
  if (!user || typeof user.userId !== "string" || user.userId.length === 0) {
    throw new Error("session_user_invalid");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.userId,
    name: typeof user.username === "string" ? user.username : "",
    avatar: typeof user.avatar === "string" ? user.avatar : "",
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };

  const segment = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signSegment(segment, secret);
  return `${segment}.${signature}`;
}

/**
 * Valida assinatura + expiração e devolve o payload da sessão.
 *
 * @param {string} token Token recebido no cookie.
 * @param {string} secret Valor de `env.SESSION_SECRET`.
 * @returns {Promise<{ uid: string, name: string, avatar: string, iat: number, exp: number } | null>}
 *   Payload válido ou `null`.
 */
export async function verifySession(token, secret) {
  if (!isValidSessionSecret(secret)) return null;
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [segment, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(segment) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

  const expected = await signSegment(segment, secret);
  if (!timingSafeEqualString(expected, signature)) return null;

  /** @type {unknown} */
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
  } catch {
    return null;
  }

  if (payload === null || typeof payload !== "object") return null;
  const candidate = /** @type {Record<string, unknown>} */ (payload);

  if (typeof candidate.uid !== "string" || candidate.uid.length === 0 || candidate.uid.length > 64) return null;
  if (typeof candidate.name !== "string" || candidate.name.length > 128) return null;
  if (typeof candidate.avatar !== "string" || candidate.avatar.length > 512) return null;
  if (typeof candidate.iat !== "number" || typeof candidate.exp !== "number") return null;
  if (!Number.isFinite(candidate.iat) || !Number.isFinite(candidate.exp)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (candidate.exp <= now) return null;
  if (candidate.exp - candidate.iat > SESSION_TTL_SECONDS + 60) return null;

  return {
    uid: candidate.uid,
    name: candidate.name,
    avatar: candidate.avatar,
    iat: candidate.iat,
    exp: candidate.exp,
  };
}

/* ------------------------------------------------------------------ *
 * Cookies
 * ------------------------------------------------------------------ */

/**
 * Parseia o header `Cookie` em um mapa simples.
 *
 * @param {string | null} header Valor do header `Cookie`.
 * @returns {Record<string, string>} Cookies por nome (último valor vence).
 */
export function parseCookies(header) {
  /** @type {Record<string, string>} */
  const cookies = {};
  if (typeof header !== "string" || header.length === 0) return cookies;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

/**
 * Serializa um cookie endurecido (`HttpOnly; Secure; SameSite=Lax; Path=/`).
 *
 * @param {string} name Nome do cookie.
 * @param {string} value Valor (já URL-safe).
 * @param {{ maxAge?: number, path?: string, sameSite?: string, httpOnly?: boolean, secure?: boolean }} [opts]
 * @returns {string} Valor do header `Set-Cookie`.
 */
export function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? "/"}`);

  if (typeof opts.maxAge === "number" && Number.isFinite(opts.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  }
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");

  return parts.join("; ");
}

/* ------------------------------------------------------------------ *
 * Sessão a partir da requisição
 * ------------------------------------------------------------------ */

/**
 * Resolve o usuário autenticado a partir do cookie de sessão.
 *
 * @param {Request} request Requisição HTTP.
 * @param {Record<string, unknown>} env Bindings do Pages Functions.
 * @returns {Promise<{ userId: string, username: string, avatar: string } | null>}
 *   Usuário autenticado ou `null` (segredo ausente, cookie inválido/expirado).
 */
export async function getSessionUser(request, env) {
  const secret = env?.SESSION_SECRET;
  if (!isValidSessionSecret(secret)) return null;

  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const payload = await verifySession(token, /** @type {string} */ (secret));
  if (!payload) return null;

  return { userId: payload.uid, username: payload.name, avatar: payload.avatar };
}

/**
 * Gera um `state` criptograficamente aleatório (32 bytes em hex).
 *
 * @returns {string} 64 caracteres hexadecimais.
 */
export function createOAuthState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
