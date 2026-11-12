const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}

async function mac(value, env) {
  const secret = env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function signValue(value, env) {
  return `${toBase64Url(encoder.encode(value))}.${toBase64Url(await mac(value, env))}`;
}

export async function verifyValue(token, env) {
  if (!token || !token.includes(".")) return null;
  try {
    const [payload, signature] = token.split(".");
    const value = new TextDecoder().decode(fromBase64Url(payload));
    const expected = await mac(value, env);
    const actual = fromBase64Url(signature);
    if (actual.length !== expected.length || !actual.every((byte, index) => byte === expected[index])) return null;
    return value;
  } catch {
    return null;
  }
}

function cookie(request, name) {
  const match = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] || "";
}

export async function getSession(request, env) {
  const raw = await verifyValue(cookie(request, "discord_session"), env);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session.userId || !session.username || !session.expiresAt || session.expiresAt < Date.now()) return null;
    return { userId: String(session.userId), username: String(session.username), avatar: String(session.avatar || "") };
  } catch {
    return null;
  }
}

export function sessionCookie(value, maxAge = 86400) {
  return `discord_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

export function jsonError(error, status) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requireSession(context) {
  const user = await getSession(context.request, context.env);
  return user ? { user } : { response: jsonError("authentication_required", 401) };
}
