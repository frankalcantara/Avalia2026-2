const SESSION_COOKIE = "__Host-discord_session";
export const STATE_COOKIE = "__Host-discord_oauth_state";
const SESSION_SECONDS = 86400;

export function oauthConfigured(env) {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET &&
    env.SESSION_SECRET?.length >= 32);
}

export function readCookie(request, name) {
  return (request.headers.get("Cookie") || "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}

export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newState() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

function signingKey(env) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(env, userId) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${userId}.${expires}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(env),
    new TextEncoder().encode(payload));
  return cookie(SESSION_COOKIE, `${payload}.${hex(signature)}`, SESSION_SECONDS);
}

export async function sessionUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  const parts = token?.match(/^(\d{1,20})\.(\d{10})\.([a-f0-9]{64})$/);
  if (!parts || !(env.SESSION_SECRET?.length >= 32) || !env.DB) return null;
  const [, userId, expires, signature] = parts;
  if (Number(expires) <= Date.now() / 1000) return null;
  const bytes = Uint8Array.from(signature.match(/../g), (pair) => parseInt(pair, 16));
  const valid = await crypto.subtle.verify("HMAC", await signingKey(env), bytes,
    new TextEncoder().encode(`${userId}.${expires}`));
  if (!valid) return null;
  return env.DB.prepare("SELECT user_id AS userId, username, avatar FROM discord_users WHERE user_id = ?")
    .bind(userId).first();
}
