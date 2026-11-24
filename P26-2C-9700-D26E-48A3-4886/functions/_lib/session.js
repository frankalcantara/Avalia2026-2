const COOKIE_NAME = "kudos_session";
const MAX_AGE = 86400;
const enc = new TextEncoder();

function toB64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function createSessionCookie(user, secret, secure) {
  const payload = toB64Url(enc.encode(JSON.stringify({
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  })));
  const key = await hmacKey(secret);
  const sig = toB64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload))));
  return `${COOKIE_NAME}=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`;
}

export async function readSession(request, secret) {
  try {
    if (!secret) return null;
    const header = request.headers.get("Cookie") || "";
    const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE_NAME + "="));
    if (!match) return null;
    const value = match.slice(COOKIE_NAME.length + 1);
    const [payload, sig] = value.split(".");
    if (!payload || !sig) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, fromB64Url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    if (!data.userId || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: String(data.userId), username: data.username, avatar: data.avatar };
  } catch {
    return null;
  }
}
