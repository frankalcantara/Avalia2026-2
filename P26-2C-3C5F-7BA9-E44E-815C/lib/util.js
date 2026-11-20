export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const fail = (message, status = 400) => json({ error: message }, status);

export function getCookie(request, name) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export const cookie = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
export const randomToken = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
export async function sha256(text) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

// Usuário da sessão (cookie HttpOnly com token aleatório; só o hash fica no D1).
export async function currentUser(request, env) {
  const token = getCookie(request, "sid");
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id, u.username, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"
  ).bind(await sha256(token), Date.now()).first();
}

// Proteção CSRF extra para escritas: a origem precisa ser a do próprio site.
export const sameOrigin = (request) => request.headers.get("origin") === new URL(request.url).origin;

export const likePattern = (s) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
