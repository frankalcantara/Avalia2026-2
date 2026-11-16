// Sessões: token aleatório no cookie, apenas o SHA-256 dele no D1
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./config.js";
import { HttpError, cookie, getCookie } from "./http.js";

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export async function createSession(env, userId) {
  const token = randomToken(32);
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), userId, expiresAt)
    .run();
  return cookie(SESSION_COOKIE, token, SESSION_MAX_AGE);
}

export async function getUser(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.avatar_url, s.expires_at
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ?`
  ).bind(hash).first();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
    return null;
  }
  return { id: row.user_id, username: row.username, avatar: row.avatar_url };
}

export async function requireUser(env, request) {
  const user = await getUser(env, request);
  if (!user) throw new HttpError(401, "unauthorized", "Entre com o Discord para continuar.");
  return user;
}

export async function destroySession(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  return cookie(SESSION_COOKIE, "", 0);
}
