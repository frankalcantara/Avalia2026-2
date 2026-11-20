import { canViewArticle, findArticle } from "../../../_lib/articles.js";
import { errorResponse, isSameOrigin, json, readJson, requireDatabase } from "../../../_lib/http.js";
import { getSession } from "../../../_lib/session.js";
import { isPositiveId } from "../../../_lib/validation.js";

export async function onRequestGet({ request, env, params }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  const article = await findArticle(env.DB, params.id);
  if (!article) return errorResponse("Artigo não encontrado.", 404);

  const user = await getSession(request, env.SESSION_SECRET);
  if (!await canViewArticle(env.DB, article, user?.userId)) {
    return errorResponse("Sala não encontrada.", 404);
  }

  const result = await env.DB.prepare(`
    SELECT c.id, c.body, c.created_at, u.user_id AS author_id, u.username, u.avatar
    FROM comments c JOIN discord_users u ON u.user_id = c.author_id
    WHERE c.article_id = ?
    ORDER BY c.created_at ASC, c.id ASC
    LIMIT 200
  `).bind(params.id).all();

  // As mesmas regras do DELETE: autor do comentário, autor do artigo ou dono da sala.
  const viewer = user?.userId || "";
  let roomOwnerId = null;
  if (article.room_id) {
    const room = await env.DB.prepare("SELECT owner_id FROM rooms WHERE id = ?")
      .bind(article.room_id).first();
    roomOwnerId = room?.owner_id || null;
  }
  const comments = (result.results || []).map((comment) => ({
    ...comment,
    can_delete: Boolean(viewer) && (
      comment.author_id === viewer || article.author_id === viewer || roomOwnerId === viewer
    ),
    can_report: Boolean(viewer) && comment.author_id !== viewer,
  }));
  return json({ comments });
}

export async function onRequestPost({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para comentar.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  const body = await readJson(request);
  const comment = typeof body?.body === "string" ? body.body.trim() : "";
  if (!comment || comment.length > 3000) return errorResponse("O comentário deve ter entre 1 e 3.000 caracteres.");

  const article = await findArticle(env.DB, params.id);
  if (!article) return errorResponse("Artigo não encontrado.", 404);
  if (!await canViewArticle(env.DB, article, user.userId)) {
    return errorResponse("Você não participa desta sala.", 403);
  }

  const result = await env.DB.prepare(
    "INSERT INTO comments (article_id, author_id, body) VALUES (?, ?, ?)",
  ).bind(params.id, user.userId, comment).run();
  return json({ ok: true, id: result.meta.last_row_id }, 201);
}
