import { HttpError } from "./http.js";

const SESSION_COOKIE = "discord_session";
const STATE_COOKIE = "discord_oauth_state";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeText(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function decodeText(value) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function cookieValue(request, name) {
  const entry = (request.headers.get("Cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return cookie(name, "", 0);
}

function secret(env) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
    throw new HttpError(500, "missing_configuration", "SESSION_SECRET deve conter pelo menos 32 caracteres.");
  }
  return env.SESSION_SECRET;
}

async function hmacKey(env) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value, env) {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function requireDB(env) {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    throw new HttpError(503, "database_unavailable", "O binding D1 DB não está configurado.");
  }
  return env.DB;
}

export function requireDiscordConfig(env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new HttpError(500, "missing_configuration", "DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET são obrigatórios.");
  }
  secret(env);
}

export function callbackUri(request, env) {
  if (env.DISCORD_REDIRECT_URI) return env.DISCORD_REDIRECT_URI;
  return new URL("/api/auth/discord/callback", request.url).href;
}

export async function createOAuthState(env) {
  secret(env);
  const random = crypto.getRandomValues(new Uint8Array(32));
  const state = bytesToBase64Url(random);
  return { state, cookie: cookie(STATE_COOKIE, await sign(state, env), 600) };
}

export async function validateOAuthState(request, env, state) {
  if (!state || typeof state !== "string") return false;
  const signedState = cookieValue(request, STATE_COOKIE);
  if (!signedState) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(env),
      base64UrlToBytes(signedState),
      new TextEncoder().encode(state),
    );
    return valid && signedState === await sign(state, env);
  } catch {
    return false;
  }
}

export async function createSessionCookie(user, env) {
  const payload = encodeText(JSON.stringify({
    user_id: user.user_id,
    username: user.username,
    avatar: user.avatar ?? null,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }));
  return cookie(SESSION_COOKIE, `${payload}.${await sign(payload, env)}`, SESSION_MAX_AGE);
}

export function expiredOAuthCookie() {
  return clearCookie(STATE_COOKIE);
}

export function logoutCookie() {
  return clearCookie(SESSION_COOKIE);
}

export async function getSession(request, env) {
  secret(env);
  requireDB(env);
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) throw new HttpError(401, "unauthenticated", "Autenticação necessária.");
  const parts = token.split(".");
  if (parts.length !== 2) throw new HttpError(401, "unauthenticated", "Sessão inválida.");
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(env),
      base64UrlToBytes(parts[1]),
      new TextEncoder().encode(parts[0]),
    );
    if (!valid) throw new Error("signature");
    const session = JSON.parse(decodeText(parts[0]));
    if (!session.user_id || typeof session.username !== "string" || !Number.isInteger(session.exp) ||
        session.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error("payload");
    }
    return {
      user_id: String(session.user_id),
      username: session.username,
      avatar: session.avatar ?? null,
    };
  } catch {
    throw new HttpError(401, "unauthenticated", "Sessão inválida ou expirada.");
  }
}
