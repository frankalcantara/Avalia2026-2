/**
 * Sessões no servidor: o navegador recebe só um token aleatório (cookie HttpOnly);
 * o D1 guarda o SHA-256 desse token. Sem o banco, o cookie não vale nada.
 */
import { cookie, parseCookies } from "./http.js";

export const SESSION_COOKIE = "ht_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookies com Secure, exceto em http://localhost (wrangler pages dev). */
export function isSecureRequest(request) {
  return new URL(request.url).protocol === "https:";
}

export async function createSession(db, userId, request) {
  const token = randomToken();
  const hash = await sha256Hex(token);
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(hash, userId, expiresAt),
  ]);
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS, secure: isSecureRequest(request) });
}

/** Devolve o usuário logado (ou null) a partir do cookie de sessão. */
export async function getSessionUser(db, request) {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (!token || token.length > 128) return null;
  const hash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT u.user_id, u.username, u.display_name, u.avatar_url
         FROM sessions s JOIN users u ON u.user_id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(hash, Date.now())
    .first();
  return row || null;
}

export async function destroySession(db, request) {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (token && token.length <= 128) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  return cookie(SESSION_COOKIE, "", { maxAge: 0, secure: isSecureRequest(request) });
}
