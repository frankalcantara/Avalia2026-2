/**
 * /api/messages — mural público.
 *   GET  : lista os depoimentos mais recentes (público).
 *   POST : cria depoimento (exige sessão; validação feita aqui, no servidor).
 */
import { cleanText, getSessionUser, isSameOrigin, json, readJsonBody } from "../_lib/util.js";

function toDto(r) {
  return {
    id: r.id,
    content: r.content,
    created_at: r.created_at,
    author: { name: r.username, avatar: r.avatar },
  };
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "database_unavailable" }, 503);
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, u.username, u.avatar
       FROM messages m JOIN users u ON u.id = m.user_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 100`
  ).all();
  return json({ messages: results.map(toDto) });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  if (!env.DB) return json({ error: "database_unavailable" }, 503);

  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "login_required" }, 401);

  const body = await readJsonBody(request);
  const content = cleanText(body && body.content, 1, 500);
  if (!content) return json({ error: "invalid_content", message: "O depoimento deve ter de 1 a 500 caracteres." }, 400);

  const createdAt = new Date().toISOString();
  const res = await env.DB.prepare(
    "INSERT INTO messages (user_id, content, created_at) VALUES (?, ?, ?)"
  ).bind(user.id, content, createdAt).run();

  return json(
    toDto({
      id: res.meta ? res.meta.last_row_id : null,
      content,
      created_at: createdAt,
      username: user.username,
      avatar: user.avatar,
    }),
    201
  );
}
