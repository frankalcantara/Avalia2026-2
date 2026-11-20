/**
 * Sessão assinada (HMAC-SHA256) em cookie HttpOnly.
 * O cliente não consegue forjar nem alterar user_id, nome ou avatar.
 * Segredo: SESSION_SECRET (opcional) ou, por padrão, DISCORD_CLIENT_SECRET.
 * Este arquivo não exporta onRequest*, portanto não vira rota.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

export const COOKIE_NAME = "discord_session";
const MAX_AGE = 86400; // 24 h

function toB64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(env) {
  const secret = env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionCookie(user, env) {
  const key = await hmacKey(env);
  if (!key) throw new Error("missing_session_secret");
  const payload = {
    userId: String(user.userId),
    username: String(user.username || ""),
    avatar: String(user.avatar || ""),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const sig = toB64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body))));
  return `${COOKIE_NAME}=${body}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}; Secure`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export async function getSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
  if (!m) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return null;
  try {
    const key = await hmacKey(env);
    if (!key) return null;
    const ok = await crypto.subtle.verify("HMAC", key, fromB64Url(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(dec.decode(fromB64Url(body)));
    if (!p.userId || !p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: String(p.userId), username: String(p.username || ""), avatar: String(p.avatar || "") };
  } catch {
    return null;
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Retorna { user } ou { response } (401/500) para o handler devolver direto. */
export async function requireUser(request, env) {
  if (!env.DB) return { response: json({ ok: false, error: "db_unavailable" }, 500) };
  const user = await getSession(request, env);
  if (!user) return { response: json({ ok: false, error: "unauthorized" }, 401) };
  return { user };
}

export async function readBody(request) {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === "object" ? body : {};
}

export function str(value, max = 64) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
