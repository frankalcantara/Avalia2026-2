import { getSessionUser } from "../_lib/session.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.body, m.created_at, u.username AS author, u.avatar
       FROM messages m JOIN discord_users u ON u.user_id = m.user_id
      ORDER BY m.id DESC LIMIT 100`
  ).all();
  return Response.json({ ok: true, messages: results });
}

export async function onRequestPost({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const data = await request.json().catch(() => ({}));
  const body = String(data.body || "").trim();
  if (body.length < 1 || body.length > 500) {
    return Response.json({ ok: false, error: "A mensagem deve ter de 1 a 500 caracteres." }, { status: 400 });
  }

  await env.DB.prepare("INSERT INTO messages (user_id, body) VALUES (?, ?)")
    .bind(user.user_id, body).run();
  return Response.json({ ok: true }, { status: 201 });
}