/** Sessões no servidor (D1) baseadas em token aleatório em cookie HttpOnly. */
import { parseCookies, isAdmin } from "./rules.js";
import { fail } from "./http.js";

export const SESSION_COOKIE = "it_session";
export const SESSION_DAYS = 7;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export function cookie(name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax", "Secure"];
  if (httpOnly) parts.push("HttpOnly");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

/** Cria a sessão no D1 e devolve o cabeçalho Set-Cookie. */
export async function createSession(env, userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), userId, expires)
    .run();
  // limpeza oportunista de sessões vencidas
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
}

/** Devolve o usuário logado { user_id, username, avatar, admin } ou null. */
export async function getSessionUser(request, env) {
  if (!env.DB) return null;
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.avatar
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first();
  if (!row) return null;
  return { ...row, admin: isAdmin(env, row.user_id) };
}

export async function destroySession(request, env) {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (env.DB && token && /^[0-9a-f]{64}$/.test(token)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  return cookie(SESSION_COOKIE, "", { maxAge: 0 });
}

/** Retorna { user } ou { response } com 401 já pronto. */
export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { response: fail(401, "Faça login com o Discord para continuar.") };
  return { user };
}
