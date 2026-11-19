// Sessões: token aleatório no cookie `sid`, apenas o SHA-256 no D1.
import { parseCookies, serializeCookie } from "./cookies.js";
import { error } from "./http.js";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60; // 7 dias em segundos

// N bytes aleatórios em hex.
export function randomHex(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 em hex.
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const nowSec = () => Math.floor(Date.now() / 1000);

// Cria sessão para o usuário e devolve o Set-Cookie correspondente.
export async function createSession(env, userId) {
  const token = randomHex(32);
  const hash = await sha256Hex(token);
  const now = nowSec();
  await env.DB.batch([
    // limpa sessões vencidas do mesmo usuário
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?").bind(userId, now),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(hash, userId, now + SESSION_TTL),
  ]);
  return serializeCookie(SESSION_COOKIE, token, SESSION_TTL);
}

// Hash do token do cookie, ou null se ausente/malformado.
export async function sessionHash(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return sha256Hex(token);
}

// Usuário da sessão válida (não expirada), ou null.
export async function getUser(env, request) {
  const hash = await sessionHash(request);
  if (!hash) return null;
  return env.DB.prepare(
    `SELECT u.user_id, u.username, u.avatar, u.balance, u.created_at
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(hash, nowSec()).first();
}

// Exige usuário autenticado: devolve { user } ou { response: 401 }.
export async function requireUser(context) {
  const user = await getUser(context.env, context.request);
  if (!user) {
    return { response: error(401, "unauthorized", "Faça login com o Discord para continuar.") };
  }
  return { user };
}
