import { json, lerCookie } from "../_util.js";

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (new URL(request.url).pathname.startsWith("/api/auth/")) return await context.next();

    const sid = lerCookie(request, "sid");
    const user = sid && await env.DB.prepare(
      `SELECT u.user_id AS userId, u.username, u.avatar
       FROM sessions s JOIN discord_users u ON u.user_id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    ).bind(sid).first();
    if (!user) return json({ erro: "nao_autenticado" }, 401);

    context.data.user = user;
    return await context.next();
  } catch (err) {
    console.error(err);
    return json({ erro: "erro_interno" }, 500);
  }
}
