// Shared helpers for the Pages Functions (not a route: exports no onRequest handler).

export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days, in seconds

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function randomHex(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Returns { userId, username, avatar } for a valid session cookie, otherwise null.
// The browser only holds a random token; the server stores its SHA-256 hash in D1.
export async function getUser(env, request) {
  const token = getCookie(request, "session");
  if (!env.DB || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT u.user_id AS userId, u.username AS username, u.avatar AS avatar
       FROM sessions s
       JOIN discord_users u ON u.user_id = s.user_id
      WHERE s.token_hash = ?1 AND s.expires_at > ?2`
  )
    .bind(await sha256Hex(token), Math.floor(Date.now() / 1000))
    .first();
  return row || null;
}
