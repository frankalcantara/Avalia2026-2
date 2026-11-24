import { isToken, randomToken, sha256Base64Url } from "./crypto.js";
import { SESSION_COOKIE, SESSION_MAX_AGE, parseCookies } from "./cookies.js";

// Procura a sessão válida a partir do cookie opaco e devolve o usuário.
// O D1 guarda apenas o SHA-256 do valor do cookie.
export async function getSessionUser(request, env) {
  const raw = parseCookies(request)[SESSION_COOKIE];
  if (!isToken(raw)) return null;
  const idHash = await sha256Base64Url(raw);
  const row = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.global_name, u.avatar
       FROM sessions s JOIN discord_users u ON u.user_id = s.user_id
      WHERE s.id_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(idHash, Date.now())
    .first();
  return row ?? null;
}

// Cria a sessão e devolve o valor bruto que vai somente para o cookie.
export async function createSession(env, userId) {
  const raw = randomToken();
  const idHash = await sha256Base64Url(raw);
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)",
  )
    .bind(idHash, userId, now + SESSION_MAX_AGE * 1000, now)
    .run();
  return raw;
}

export async function deleteSession(request, env) {
  const raw = parseCookies(request)[SESSION_COOKIE];
  if (!isToken(raw)) return;
  const idHash = await sha256Base64Url(raw);
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(idHash).run();
}

export async function purgeExpired(env) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?1").bind(now),
  ]);
}
