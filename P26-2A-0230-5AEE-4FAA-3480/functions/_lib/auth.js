import { database, HttpError } from "./http.js";

export const SESSION_COOKIE = "almoxarifado_session";
export const OAUTH_COOKIE = "almoxarifado_oauth";
export const OAUTH_CALLBACK = "/api/auth/discord/callback";
export const SESSION_SECONDS = 8 * 60 * 60;
export const OAUTH_SECONDS = 10 * 60;

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const encoder = new TextEncoder();

export function checkAuthConfig(env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new HttpError(503, "A conexão com o Discord ainda precisa ser configurada.");
  }
  sessionSecret(env);
}

function sessionSecret(env) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
    throw new HttpError(503, "O login está indisponível por falta da configuração de sessão.");
  }
  return env.SESSION_SECRET;
}

function signKey(env) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/") + "="), (char) => char.charCodeAt(0));
}

export async function signToken(env, purpose, id) {
  const key = await signKey(env);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(purpose + ":" + id));
  return id + "." + toBase64Url(new Uint8Array(signature));
}

export async function verifyToken(env, purpose, token) {
  if (!token) return null;

  const [id, signature, extra] = token.split(".");
  if (extra !== undefined || !UUID_PATTERN.test(id) || !SIGNATURE_PATTERN.test(signature)) {
    return null;
  }
  const key = await signKey(env);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signature),
    encoder.encode(purpose + ":" + id),
  );
  return valid ? id : null;
}

export function readCookie(request, name) {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const entry of cookies.split(";")) {
    const value = entry.trim();
    if (value.startsWith(name + "=")) {
      return value.slice(name.length + 1);
    }
  }
  return null;
}

export function authCookie(request, name, value, maxAge) {
  const path = name === OAUTH_COOKIE ? OAUTH_CALLBACK : "/";
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return name + "=" + value + "; Path=" + path + "; Max-Age=" + maxAge + "; HttpOnly; SameSite=Lax" + secure;
}

export async function readSession(request, env) {
  const id = await verifyToken(env, "session", readCookie(request, SESSION_COOKIE));
  if (!id) return null;

  const user = await database(env).prepare(
    "SELECT u.user_id, u.username, u.avatar AS avatar_url" +
      " FROM sessions s JOIN discord_users u ON u.user_id = s.user_id" +
      " WHERE s.id = ? AND s.expires_at > ?",
  ).bind(id, nowInSeconds()).first();
  return user ? { id, user } : null;
}

export async function requireUser(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    throw new HttpError(401, "Entre com o Discord para continuar.");
  }
  return session.user;
}

export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}
