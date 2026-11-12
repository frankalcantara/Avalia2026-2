import { hashToken, readToken } from "../../lib/auth.js";

export async function onRequest(context) {
  context.data.user = null;
  context.data.authError = false;

  const token = readToken(context.request);
  if (token) {
    try {
      if (!context.env.DB) throw new Error("D1 indisponível");
      const tokenHash = await hashToken(token);
      context.data.user = await context.env.DB.prepare(
        `SELECT u.user_id, u.username, u.avatar
         FROM auth_sessions AS s
         JOIN discord_users AS u ON u.user_id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > unixepoch()`
      ).bind(tokenHash).first() || null;
    } catch {
      // O diagnóstico e as rotas públicas continuam acessíveis em caso de falha.
      context.data.authError = true;
    }
  }

  return context.next();
}
