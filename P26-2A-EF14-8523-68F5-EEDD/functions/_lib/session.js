export async function getSessionUser(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  if (!m) return null;

  const row = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.avatar
       FROM sessions s
       JOIN discord_users u ON u.user_id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`
  ).bind(m[1], new Date().toISOString()).first();

  return row || null;
}
