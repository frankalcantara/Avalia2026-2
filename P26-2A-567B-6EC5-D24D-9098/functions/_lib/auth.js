/**
 * Helpers de sessão do login Discord: cookies, ids aleatórios, formato de data e getUser().
 * Não é uma rota (não exporta onRequest*).
 */

export const SESSION_COOKIE = "discord_session";
export const STATE_COOKIE = "discord_oauth_state";
// O cookie do state só precisa chegar em /api/auth/discord e /api/auth/discord/callback.
export const STATE_COOKIE_PATH = "/api/auth/discord";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias
export const STATE_TTL_SECONDS = 10 * 60; // 10 minutos
export const DEFAULT_AVATAR_URL = "https://cdn.discordapp.com/embed/avatars/0.png";

const SESSION_ID_PATTERN = /^[0-9a-f]{64}$/; // 32 bytes em hexadecimal

/** Gera `bytes` bytes aleatórios (crypto.getRandomValues) e devolve em hexadecimal. */
export function randomHex(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Formato único de data no banco: "YYYY-MM-DD HH:MM:SS" em UTC.
 * É o mesmo formato do CURRENT_TIMESTAMP do SQLite, então pode ser comparado como texto.
 * Toda gravação e toda comparação de expires_at usam esta função.
 */
export function sqlTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function parseCookies(request) {
  const cookies = {};
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (name && !(name in cookies)) cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}

export function buildCookie(name, value, { maxAge, path = "/" }) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=${path}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name, path = "/") {
  return buildCookie(name, "", { maxAge: 0, path });
}

/** Comparação em tempo constante para strings (usada no state do OAuth2). */
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lê o id da sessão do cookie; devolve null se ausente ou com formato inválido. */
export function readSessionId(request) {
  const value = parseCookies(request)[SESSION_COOKIE];
  return value && SESSION_ID_PATTERN.test(value) ? value : null;
}

/** O banco guarda só o hash do avatar; a URL completa é montada na resposta. */
export function avatarUrl(userId, avatarHash) {
  if (!avatarHash) return DEFAULT_AVATAR_URL;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}

/**
 * Cookie -> sessions + discord_users -> valida expiração.
 * Devolve { user_id, username, avatar } (avatar já como URL completa) ou null.
 * Erros de banco não são engolidos: quem chama decide responder 500.
 */
export async function getUser(request, env) {
  if (!env.DB) return null;
  const sessionId = readSessionId(request);
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    "SELECT u.user_id AS user_id, u.username AS username, u.avatar AS avatar " +
      "FROM sessions s JOIN discord_users u ON u.user_id = s.user_id " +
      "WHERE s.id = ? AND s.expires_at > ?"
  )
    .bind(sessionId, sqlTimestamp())
    .first();

  if (!row) return null;
  return {
    user_id: row.user_id,
    username: row.username,
    avatar: avatarUrl(row.user_id, row.avatar),
  };
}