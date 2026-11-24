import { canViewArticle, findArticle } from "../../../_lib/articles.js";
import { errorResponse, isSameOrigin, json, readJson, requireDatabase } from "../../../_lib/http.js";
import { getSession } from "../../../_lib/session.js";
import { isPositiveId } from "../../../_lib/validation.js";

export async function onRequestPost({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para denunciar.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Comentário não encontrado.", 404);

  const comment = await env.DB.prepare(
    "SELECT id, article_id FROM comments WHERE id = ?",
  ).bind(params.id).first();
  if (!comment) return errorResponse("Comentário não encontrado.", 404);

  const article = await findArticle(env.DB, comment.article_id);
  if (!article || !await canViewArticle(env.DB, article, user.userId)) {
    return errorResponse("Comentário não encontrado.", 404);
  }

  const body = await readJson(request);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  await env.DB.prepare(
    "INSERT OR IGNORE INTO comment_reports (comment_id, reporter_id, reason) VALUES (?, ?, ?)",
  ).bind(params.id, user.userId, reason).run();
  return json({ ok: true });
}
