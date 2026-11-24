// Sessões opacas no servidor: o cookie "session" guarda só um token aleatório,
// procurado na tabela sessions. Nenhuma identidade é confiada ao cliente.
import { HttpError } from "./http.js";

export const SESSION_COOKIE = "session";
export const STATE_COOKIE = "oauth_state";
export const SESSION_MAX_AGE = 604800; // 7 dias, em segundos
const STATE_PATH = "/api/auth/discord";

// Token aleatório de 32 bytes em hexadecimal (64 caracteres).
export function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseCookies(request) {
  const out = {};
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name && !(name in out)) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

const TOKEN_RE = /^[0-9a-f]{64}$/;

// Retorna a linha de users do dono da sessão válida, ou null.
export async function getSessionUser(env, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || !TOKEN_RE.test(token) || !env.DB) return null;
  const row = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.display_name, u.avatar_url
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  return row || null;
}

// Exige sessão válida; senão 401.
export async function requireUser(env, request) {
  const user = await getSessionUser(env, request);
  if (!user) throw new HttpError(401, "unauthorized", "Faça login com o Discord para continuar.");
  return user;
}

export function sessionToken(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  return token && TOKEN_RE.test(token) ? token : null;
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function stateCookie(state) {
  return `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=${STATE_PATH}; Max-Age=600`;
}

export function clearStateCookie() {
  return `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=${STATE_PATH}; Max-Age=0`;
}

// Comparação em tempo constante (evita vazar o state por timing).
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function discordConfigured(env) {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}
