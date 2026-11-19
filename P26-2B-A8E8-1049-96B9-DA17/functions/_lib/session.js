/** Sessão em cookie assinado (HMAC-SHA256) com expiração. Segredo: env.SESSION_SECRET. */
export const SESSION_COOKIE = "discord_session";
export const STATE_COOKIE = "discord_oauth_state";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 dias
export const STATE_TTL = 600; // 10 min

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const p = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

export async function signSession(user, secret, now = Date.now()) {
  const payload = { u: user.userId, n: user.username, a: user.avatar ?? null, exp: Math.floor(now / 1000) + SESSION_TTL };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), enc.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySession(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), b64urlDecode(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    if (!p || typeof p.u !== "string" || typeof p.exp !== "number" || p.exp * 1000 <= now) return null;
    return { userId: p.u, username: String(p.n ?? ""), avatar: p.a ?? null };
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function buildCookie(name, value, { maxAge, secure, path = "/" }) {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

/** Retorna {userId, username, avatar} ou null. */
export async function getSessionUser(request, env) {
  return verifySession(getCookie(request, SESSION_COOKIE), env.SESSION_SECRET);
}

export function randomState() {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(24)));
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function redirectUriFor(request) {
  return new URL("/api/auth/discord/callback", new URL(request.url).origin).href;
}
