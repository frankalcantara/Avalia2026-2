import { getUser, unauthorized } from "../../_lib/auth.js";
import { error, json, validId } from "../../_lib/http.js";

export async function onRequestGet({ request, params, env }) {
  if (!validId(params.id)) return error("Artigo não encontrado.", 404);
  const user = await getUser(request, env);
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM likes WHERE post_id = ?").bind(params.id).first();
  let liked = false;
  if (user) {
    const found = await env.DB.prepare("SELECT 1 AS yes FROM likes WHERE post_id = ? AND user_id = ?")
      .bind(params.id, user.id).first();
    liked = !!found;
  }
  return json({ count: row?.count || 0, liked });
}

export async function onRequestPost({ request, params, env }) {
  const user = await getUser(request, env);
  if (!user) return unauthorized();
  if (!validId(params.id)) return error("Artigo não encontrado.", 404);
  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(params.id).first();
  if (!post) return error("Artigo não encontrado.", 404);
  const found = await env.DB.prepare("SELECT 1 AS yes FROM likes WHERE post_id = ? AND user_id = ?")
    .bind(params.id, user.id).first();
  if (found) {
    await env.DB.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").bind(params.id, user.id).run();
  } else {
    await env.DB.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").bind(params.id, user.id).run();
  }
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM likes WHERE post_id = ?").bind(params.id).first();
  return json({ count: row?.count || 0, liked: !found });
}
