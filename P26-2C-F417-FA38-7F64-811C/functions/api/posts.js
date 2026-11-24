import { getUser, unauthorized } from "./_lib/auth.js";
import { error, json, readJson } from "./_lib/http.js";

export async function onRequestGet({ env }) {
  const result = await env.DB.prepare(`
    SELECT p.id, p.title, p.excerpt, p.content, p.created_at, p.updated_at,
           u.id AS author_id, u.username, u.global_name, u.avatar,
           (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count
    FROM posts p JOIN users u ON u.id = p.author_id
    ORDER BY p.created_at DESC LIMIT 100
  `).all();
  return json({ posts: result.results || [] });
}

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return unauthorized();
  const body = await readJson(request);
  if (!body || typeof body.title !== "string" || typeof body.content !== "string") return error("Informe título e conteúdo.");
  const title = body.title.trim();
  const content = body.content.trim();
  if (title.length < 3 || title.length > 160) return error("O título deve ter entre 3 e 160 caracteres.");
  if (content.length < 1 || content.length > 30000) return error("O artigo deve ter entre 1 e 30.000 caracteres.");
  const id = crypto.randomUUID();
  const excerpt = content.replace(/\s+/g, " ").slice(0, 220);
  await env.DB.prepare("INSERT INTO posts (id, author_id, title, excerpt, content) VALUES (?, ?, ?, ?, ?)")
    .bind(id, user.id, title, excerpt, content).run();
  return json({ id }, 201);
}
