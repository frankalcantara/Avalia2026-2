import { errorResponse, isSameOrigin, json, requireDatabase } from "../../_lib/http.js";
import { getSession } from "../../_lib/session.js";
import { isPositiveId } from "../../_lib/validation.js";

async function loadComment(db, commentId) {
  return db.prepare(`
    SELECT c.id, c.author_id, c.article_id, a.author_id AS article_author, a.room_id, r.owner_id
    FROM comments c
    JOIN articles a ON a.id = c.article_id
    LEFT JOIN rooms r ON r.id = a.room_id
    WHERE c.id = ?
  `).bind(commentId).first();
}

function canModerate(comment, userId) {
  if (!userId) return false;
  return comment.author_id === userId
    || comment.article_author === userId
    || comment.owner_id === userId;
}

export async function onRequestDelete({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para excluir um comentário.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Comentário não encontrado.", 404);

  const comment = await loadComment(env.DB, params.id);
  if (!comment) return errorResponse("Comentário não encontrado.", 404);
  if (!canModerate(comment, user.userId)) {
    return errorResponse("Só o autor, o autor do artigo ou o dono da sala podem excluir este comentário.", 403);
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM comment_reports WHERE comment_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(params.id),
  ]);
  return json({ ok: true });
}
