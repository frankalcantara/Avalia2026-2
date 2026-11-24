import { getUser, unauthorized } from "../_lib/auth.js";
import { error, json, readJson, validId } from "../_lib/http.js";

export async function onRequestGet({ params, env }) {
  const id = params.id;
  if (!validId(id)) return error("Artigo não encontrado.", 404);
  const post = await env.DB.prepare(`
    SELECT p.id, p.title, p.excerpt, p.content, p.created_at, p.updated_at,
           u.id AS author_id, u.username, u.global_name, u.avatar,
           (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?
  `).bind(id).first();
  return post ? json({ post }) : error("Artigo não encontrado.", 404);
}

export async function onRequestPatch({ request, params, env }) {
  const user = await getUser(request, env);
  if (!user) return unauthorized();
  const id = params.id;
  if (!validId(id)) return error("Artigo não encontrado.", 404);
  const body = await readJson(request);
  if (!body || typeof body.title !== "string" || typeof body.content !== "string") return error("Dados inválidos.");
  const title = body.title.trim();
  const content = body.content.trim();
  if (title.length < 3 || title.length > 160 || content.length < 1 || content.length > 30000) return error("Título ou conteúdo fora do limite.");
  const excerpt = content.replace(/\s+/g, " ").slice(0, 220);
  const result = await env.DB.prepare(`
    UPDATE posts SET title = ?, content = ?, excerpt = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND author_id = ?
  `).bind(title, content, excerpt, id, user.id).run();
  if (!result.meta?.changes) return error("Artigo não encontrado ou você não é o autor.", 404);
  return json({ ok: true });
}

export async function onRequestDelete({ request, params, env }) {
  const user = await getUser(request, env);
  if (!user) return unauthorized();
  const id = params.id;
  if (!validId(id)) return error("Artigo não encontrado.", 404);
  const result = await env.DB.prepare("DELETE FROM posts WHERE id = ? AND author_id = ?").bind(id, user.id).run();
  if (!result.meta?.changes) return error("Artigo não encontrado ou você não é o autor.", 404);
  return json({ ok: true });
}
