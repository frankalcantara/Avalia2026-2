/**
 * Utilitários de sessão (usado pelas Cloudflare Functions).
 * O cookie guarda só um token aleatório; quem é o usuário fica no D1 (tabela sessions).
 * Assim o cliente não consegue forjar a identidade de outro jogador.
 */
export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 horas

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function sessionCookie(id) {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}; Secure`;
}

// Cria uma sessão no D1 e devolve o token (256 bits aleatórios, em hexadecimal).
export async function createSession(env, userId) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', ?))"
  ).bind(id, userId, `+${SESSION_TTL_SECONDS} seconds`).run();
  return id;
}

// Devolve { userId, username, avatar } se o cookie tiver uma sessão válida; senão null.
export async function getSessionUser(env, request) {
  const id = getCookie(request, SESSION_COOKIE);
  if (!id || !env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT u.user_id AS userId, u.username AS username, u.avatar AS avatar " +
    "FROM sessions s JOIN discord_users u ON u.user_id = s.user_id " +
    "WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).bind(id).first();
  return row || null;
}
