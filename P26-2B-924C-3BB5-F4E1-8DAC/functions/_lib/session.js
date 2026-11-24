import { database, RequestError } from "./http.js";

export const STATE_COOKIE = "__Host-portfolio_state";
export const SESSION_COOKIE = "__Host-portfolio_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const HEX_TOKEN = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function readCookie(request, name) {
  for (const segment of (request.headers.get("Cookie") ?? "").split(";")) {
    const entry = segment.trimStart();
    if (entry.startsWith(name + "=")) return entry.slice(name.length + 1);
  }
  return "";
}

export function cookie(name, value, seconds) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
}

function signingKey(env) {
  if (!env.DISCORD_CLIENT_SECRET) throw new RequestError("Login Discord indisponível.", 503);
  return crypto.subtle.importKey(
    "raw", encoder.encode(env.DISCORD_CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

function signingData(token) {
  return encoder.encode("portfolio-session:" + token);
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toHex(new Uint8Array(digest));
}

async function sessionHash(request, env) {
  const value = readCookie(request, SESSION_COOKIE);
  const [token, signature, extra] = value.split(".");
  if (!HEX_TOKEN.test(token) || !HEX_TOKEN.test(signature) || extra !== undefined) return null;
  const signatureBytes = Uint8Array.from(signature.match(/../g), (pair) => Number.parseInt(pair, 16));
  const verified = await crypto.subtle.verify(
    "HMAC", await signingKey(env), signatureBytes, signingData(token),
  );
  return verified ? hashToken(token) : null;
}

export async function createSession(request, env, user) {
  const db = database(env);
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(env), signingData(token));
  const now = Math.floor(Date.now() / 1000);
  const previousHash = await sessionHash(request, env);
  const statements = [
    db.prepare(`INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar,
        updated_at = CURRENT_TIMESTAMP`).bind(user.id, user.username, user.avatar),
    db.prepare("DELETE FROM portfolio_sessions WHERE expires_at <= ? OR token_hash = ?").bind(now, previousHash),
    db.prepare("INSERT INTO portfolio_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(tokenHash, user.id, now + SESSION_SECONDS),
  ];
  await db.batch(statements);

  return cookie(SESSION_COOKIE, token + "." + toHex(new Uint8Array(signature)), SESSION_SECONDS);
}

export async function sessionUser(request, env) {
  const hash = await sessionHash(request, env);
  if (!hash) return null;
  return database(env).prepare(`
    SELECT u.user_id AS id, u.username, u.avatar
    FROM portfolio_sessions s JOIN discord_users u ON u.user_id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(hash, Math.floor(Date.now() / 1000)).first();
}

export async function requireUser(request, env) {
  const user = await sessionUser(request, env);
  if (!user) throw new RequestError("Entre com o Discord.", 401);
  return user;
}

export async function logout(request, env) {
  const hash = await sessionHash(request, env);
  if (hash) await database(env).prepare("DELETE FROM portfolio_sessions WHERE token_hash = ?").bind(hash).run();
  return cookie(SESSION_COOKIE, "", 0);
}
