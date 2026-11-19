const enc = new TextEncoder();

export async function signValue(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// Devolve { userId, username, avatar } se a sessão for válida; senão null.
export async function getSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const cookies = parseCookies(request.headers.get("Cookie"));
  const payload = cookies.discord_session;
  const sig = cookies.discord_session_sig;
  if (!payload || !sig) return null;
  const expected = await signValue(env.SESSION_SECRET, payload);
  if (!safeEqual(expected, sig)) return null;
  try {
    const data = JSON.parse(decodeURIComponent(atob(payload)));
    return data && data.userId ? data : null;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}