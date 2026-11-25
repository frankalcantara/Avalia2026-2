import {
  apiError,
  json,
  missingDatabase,
  parseId,
  readJson,
  serverError,
} from "../../../_shared/http.js";
import { readSession } from "../../../_shared/session.js";

export async function onRequestPost({ request, env, params }) {
  const user = await readSession(request, env.SESSION_SECRET);
  if (!user) {
    return apiError(401, "unauthenticated", "Entre com o Discord para responder.");
  }
  if (!env.DB) {
    return missingDatabase();
  }

  const questionId = parseId(params.questionId);
  if (!questionId) {
    return apiError(400, "invalid_question_id", "O identificador da pergunta é inválido.");
  }

  const body = await readJson(request);
  if (!body) {
    return apiError(400, "invalid_json", "Envie um corpo JSON válido.");
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 15000) {
    return apiError(400, "invalid_content", "A resposta é obrigatória e deve ter até 15000 caracteres.");
  }

  try {
    const result = await env.DB.prepare(`
      INSERT INTO answers (question_id, author_user_id, content)
      SELECT ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM questions WHERE id = ? AND status = 'open'
      )
    `).bind(questionId, user.userId, content, questionId).run();
    if (result.meta?.changes !== 1) {
      const question = await env.DB.prepare(
        "SELECT id, status FROM questions WHERE id = ?",
      ).bind(questionId).first();
      if (!question) {
        return apiError(404, "question_not_found", "A pergunta solicitada não existe.");
      }
      return apiError(409, "question_resolved", "Não é possível responder a uma pergunta resolvida.");
    }

    const answer = await env.DB.prepare(`
      SELECT
        a.id,
        a.question_id AS questionId,
        a.content,
        a.author_user_id AS authorUserId,
        u.username AS authorUsername,
        u.avatar AS authorAvatar,
        a.created_at AS createdAt
      FROM answers a
      JOIN discord_users u ON u.user_id = a.author_user_id
      WHERE a.id = ?
    `).bind(result.meta?.last_row_id).first();

    if (!answer) {
      throw new Error("The newly created answer could not be read back.");
    }

    return json({
      id: answer.id,
      questionId: answer.questionId,
      content: answer.content,
      author: {
        userId: answer.authorUserId,
        username: answer.authorUsername,
        avatar: answer.authorAvatar,
      },
      accepted: false,
      createdAt: answer.createdAt,
    }, 201);
  } catch (error) {
    return serverError("POST /api/questions/:questionId/answers", error);
  }
}
