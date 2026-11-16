/**
 * Helpers de sessao compartilhados pelas Pages Functions.
 * O token de sessao so existe no cookie do navegador; no D1 fica apenas o hash.
 */

export function randomToken(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, "0")).join("");
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// Retorna { user_id, username, avatar } do usuario logado, ou null.
export async function getSessionUser(request, env) {
  const token = getCookie(request, "session");
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT u.user_id, u.username, u.avatar FROM sessions s JOIN discord_users u ON u.user_id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"
  )
    .bind(hash, Date.now())
    .first();
  return row || null;
}