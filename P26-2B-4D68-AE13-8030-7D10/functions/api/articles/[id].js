import {
  ARTICLE_FIELDS, canViewArticle, findArticle, findArticleForRevision, parseArticleInput,
} from "../../_lib/articles.js";
import { errorResponse, isSameOrigin, json, readJson, requireDatabase } from "../../_lib/http.js";
import { canViewRoom } from "../../_lib/rooms.js";
import { getSession } from "../../_lib/session.js";
import { snapshotRevision } from "../../_lib/revisions.js";
import { replaceTags } from "../../_lib/tags.js";
import { isPositiveId } from "../../_lib/validation.js";

const ARTICLE_QUERY = `
  SELECT ${ARTICLE_FIELDS}
  FROM articles a
  JOIN discord_users u ON u.user_id = a.author_id
  LEFT JOIN rooms r ON r.id = a.room_id
  WHERE a.id = ?
`;

export async function onRequestGet({ request, env, params }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  const session = await getSession(request, env.SESSION_SECRET);
  const viewer = session?.userId || "";
  const article = await env.DB.prepare(ARTICLE_QUERY).bind(viewer, params.id).first();
  if (!article) return errorResponse("Artigo não encontrado.", 404);
  if (!await canViewArticle(env.DB, article, viewer)) {
    return errorResponse("Sala não encontrada.", 404);
  }
  return json({ article });
}

export async function onRequestPut({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para editar.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  // Editar exige acesso à sala atual do artigo: quem foi removido não reescreve o que ficou para trás.
  const article = await findArticle(env.DB, params.id);
  if (!article) return errorResponse("Artigo não encontrado.", 404);
  if (!await canViewArticle(env.DB, article, user.userId)) {
    return errorResponse("Você não participa mais desta sala.", 403);
  }

  const input = parseArticleInput(await readJson(request));
  if (input.error) return errorResponse(input.error);
  if (input.roomId !== null && !await canViewRoom(env.DB, input.roomId, user.userId)) {
    return errorResponse("Você não participa desta sala.", 403);
  }

  const current = await findArticleForRevision(env.DB, params.id);
  const result = await env.DB.prepare(
    "UPDATE articles SET title = ?, body = ?, room_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND author_id = ?",
  ).bind(input.title, input.body, input.roomId, params.id, user.userId).run();
  if (!result.meta.changes) return errorResponse("Artigo não encontrado ou sem permissão.", 404);

  if (current) await snapshotRevision(env.DB, current, user.userId);
  await replaceTags(env.DB, params.id, input.tags);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para excluir.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  const owned = await env.DB.prepare("SELECT id FROM articles WHERE id = ? AND author_id = ?")
    .bind(params.id, user.userId).first();
  if (!owned) return errorResponse("Artigo não encontrado ou sem permissão.", 404);

  // Limpeza explícita: não depende de ON DELETE CASCADE estar ativo no D1.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM comments WHERE article_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM article_likes WHERE article_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM article_revisions WHERE article_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM articles WHERE id = ? AND author_id = ?").bind(params.id, user.userId),
  ]);
  return json({ ok: true });
}

