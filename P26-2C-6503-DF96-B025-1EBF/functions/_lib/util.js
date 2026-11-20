/**
 * Utilitários compartilhados pelas Pages Functions (sessão, cookies, respostas JSON).
 * O prefixo "_" em _lib evita que o Cloudflare trate o arquivo como rota.
 */

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function parseCookies(request) {
  const out = {};
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function buildCookie(name, value, { maxAge, path = "/" } = {}) {
  let c = `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

export function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cria a sessão no D1 e devolve o token em texto (vai só no cookie). */
export async function createSession(env, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, userId, now.toISOString(), expires.toISOString()).run();
  // limpeza oportunista de sessões vencidas
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()).run();
  return token;
}

/** Retorna o usuário da sessão ou null. Nunca confia em dados vindos do cliente. */
export async function getSessionUser(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token) || !env.DB) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.avatar
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(tokenHash, new Date().toISOString()).first();
  return row || null;
}

export async function destroySession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || !env.DB) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

/** Defesa extra contra CSRF em requisições que alteram dados. */
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false; // navegadores sempre enviam Origin em POST cross-site
  return origin === new URL(request.url).origin;
}

export async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export function cleanText(value, min, max) {
  if (typeof value !== "string") return null;
  const t = value.replace(/\r\n/g, "\n").trim();
  if (t.length < min || t.length > max) return null;
  return t;
}
