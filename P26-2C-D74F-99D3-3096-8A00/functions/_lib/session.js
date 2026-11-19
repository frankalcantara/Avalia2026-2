const enc = new TextEncoder();

export const SESSION_COOKIE = "session";
export const STATE_COOKIE = "oauth_state";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 dias

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function cookieString(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSessionCookie(request, env, user) {
  const payload = {
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    exp: Date.now() + SESSION_TTL * 1000,
  };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(body));
  return cookieString(request, SESSION_COOKIE, `${body}.${b64urlEncode(new Uint8Array(sig))}`, SESSION_TTL);
}

export function clearCookie(request, name) {
  return cookieString(request, name, "", 0);
}

// Retorna { userId, username, avatar } ou null
export async function readSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC", await hmacKey(env.SESSION_SECRET), b64urlDecode(sig), enc.encode(body)
    );
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!data.exp || data.exp < Date.now()) return null;
    return { userId: data.userId, username: data.username, avatar: data.avatar };
  } catch {
    return null;
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}