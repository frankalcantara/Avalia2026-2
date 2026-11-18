import { getUser, unauthorized } from "../../_lib/auth.js";
import { error, json, readJson, validId } from "../../_lib/http.js";

export async function onRequestGet({ params, env }) {
  if (!validId(params.id)) return error("Artigo não encontrado.", 404);
  const rows = await env.DB.prepare(`
    SELECT c.id, c.content, c.created_at, u.id AS author_id,
           u.username, u.global_name, u.avatar
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).bind(params.id).all();
  return json({ comments: rows.results || [] });
}

export async function onRequestPost({ request, params, env }) {
  const user = await getUser(request, env);
  if (!user) return unauthorized();
  if (!validId(params.id)) return error("Artigo não encontrado.", 404);
  const body = await readJson(request);
  if (!body || typeof body.content !== "string") return error("Comentário inválido.");
  const content = body.content.trim();
  if (!content || content.length > 2000) return error("O comentário deve ter até 2.000 caracteres.");
  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(params.id).first();
  if (!post) return error("Artigo não encontrado.", 404);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO comments (id, post_id, author_id, content) VALUES (?, ?, ?, ?)")
    .bind(id, params.id, user.id, content).run();
  return json({ id }, 201);
}
