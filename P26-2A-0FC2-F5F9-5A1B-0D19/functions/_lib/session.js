// Sessões e cookies. No D1 fica apenas o SHA-256 do token; o token puro só vive no cookie.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19

export const SESSION_COOKIE = "sessao";
export const STATE_COOKIE = "oauth_state";
export const SESSION_MAX_AGE = 604800; // 7 dias, em segundos

// Gera 32 bytes aleatórios em hexadecimal (token de sessão e state do OAuth).
export function randomHex(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 em hexadecimal via Web Crypto.
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Lê um cookie pelo nome a partir do cabeçalho Cookie.
export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Monta Set-Cookie com os atributos exigidos pelo SPEC.
export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// Cookie que expira imediatamente (remoção).
export const clearCookie = (name) => cookie(name, "", 0);

// Cria sessão para o usuário e devolve o Set-Cookie correspondente.
export async function createSession(env, userId) {
  const token = randomHex(32);
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), userId, expiresAt)
    .run();
  return cookie(SESSION_COOKIE, token, SESSION_MAX_AGE);
}

// Lê a sessão do cookie. Retorna o usuário { user_id, username, avatar_url } ou null.
// Sessão expirada é apagada e tratada como ausente.
export async function getSessionUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.user_id, u.username, u.avatar_url
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ?`
  ).bind(hash).first();
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
    return null;
  }
  return { user_id: row.user_id, username: row.username, avatar_url: row.avatar_url };
}

// Apaga a sessão atual (logout). Não falha se não houver sessão.
export async function destroySession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}
