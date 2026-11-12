import { appOrigin, readCookie } from "./http.js";

const encoder = new TextEncoder();
export const STATE_COOKIE = "__Host-termo_oauth";
export const SESSION_COOKIE = "__Host-termo_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

export function discordConfigured(env) {
  return Boolean(env.DB && env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
    && env.SESSION_SECRET?.length >= 32);
}

export function discordCallback(request, env) {
  return new URL("/api/auth/discord/callback", appOrigin(request, env)).href;
}

export function randomToken() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(token) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return hex(new Uint8Array(bytes));
}

async function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(env, userId) {
  const token = randomToken();
  const key = await signingKey(env.SESSION_SECRET);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await tokenHash(token), userId, now + SESSION_SECONDS).run();
  return `${token}.${hex(new Uint8Array(signature))}`;
}

async function verifiedHash(request, env) {
  const signedToken = readCookie(request, SESSION_COOKIE);
  if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(signedToken) || !env.SESSION_SECRET) {
    return null;
  }
  const [token, signature] = signedToken.split(".");
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g), (pair) => parseInt(pair, 16));
  const key = await signingKey(env.SESSION_SECRET);
  const verified = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(token));
  return verified ? tokenHash(token) : null;
}

export async function getUser(request, env) {
  const hash = await verifiedHash(request, env);
  if (!hash) return null;
  return env.DB.prepare(`
    SELECT u.user_id, u.username, u.avatar
    FROM sessions AS s JOIN discord_users AS u ON u.user_id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(hash, Math.floor(Date.now() / 1000)).first();
}

export async function deleteSession(request, env) {
  const hash = await verifiedHash(request, env);
  if (hash) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
}
