const enc = new TextEncoder();

function toB64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function getKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function createSessionCookie(payload, secret) {
  const body = toB64url(enc.encode(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })));
  const key = await getKey(secret);
  const sig = toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body))));
  return `${body}.${sig}`;
}

export async function readSession(request, secret) {
  if (!secret) return null;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)discord_session=([^;]+)/);
  if (!m) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return null;
  try {
    const key = await getKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}