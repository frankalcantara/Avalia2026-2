import { parseCookies, isLocalhost } from './http.js';

export const COOKIE_NAME = 'kb_session';
export const SESSION_TTL = 604800; // 7 dias (s)

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSessionCookie(request, token) {
  let c = `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
  if (!isLocalhost(request)) c += '; Secure';
  return c;
}

export function buildClearCookie(request) {
  let c = `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  if (!isLocalhost(request)) c += '; Secure';
  return c;
}

// Cria sessão no D1 (guarda só o hash) e devolve o valor do header Set-Cookie.
export async function createSession(env, request, userId) {
  const token = randomHex(32);
  const hash = await sha256Hex(token);
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(hash, userId, expires)
    .run();
  return buildSessionCookie(request, token);
}

// Retorna { id, username, avatar } ou null.
export async function getSessionUser(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return null;
  const hash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.id AS id, u.username AS username, u.avatar AS avatar
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(hash, now)
    .first();
  return row || null;
}

export async function destroySession(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return;
  const hash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
}
