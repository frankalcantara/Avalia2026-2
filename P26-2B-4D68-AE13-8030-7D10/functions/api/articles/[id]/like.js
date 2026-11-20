import { canViewArticle, findArticle } from "../../../_lib/articles.js";
import { errorResponse, isSameOrigin, json, requireDatabase } from "../../../_lib/http.js";
import { getSession } from "../../../_lib/session.js";
import { isPositiveId } from "../../../_lib/validation.js";

export async function onRequestPost({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para curtir.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  const article = await findArticle(env.DB, params.id);
  if (!article) return errorResponse("Artigo não encontrado.", 404);
  if (!await canViewArticle(env.DB, article, user.userId)) {
    return errorResponse("Você não participa desta sala.", 403);
  }

  const existing = await env.DB.prepare(
    "SELECT 1 FROM article_likes WHERE article_id = ? AND user_id = ?",
  ).bind(params.id, user.userId).first();

  if (existing) {
    await env.DB.prepare("DELETE FROM article_likes WHERE article_id = ? AND user_id = ?")
      .bind(params.id, user.userId).run();
  } else {
    await env.DB.prepare("INSERT INTO article_likes (article_id, user_id) VALUES (?, ?)")
      .bind(params.id, user.userId).run();
  }

  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM article_likes WHERE article_id = ?")
    .bind(params.id).first();
  return json({ ok: true, liked: !existing, count: Number(count?.count || 0) });
}
