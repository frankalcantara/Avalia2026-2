import {
  apiError,
  json,
  missingDatabase,
  parseId,
  readJson,
  serverError,
} from "../../../_shared/http.js";
import { readSession } from "../../../_shared/session.js";

export async function onRequestPut({ request, env, params }) {
  const user = await readSession(request, env.SESSION_SECRET);
  if (!user) {
    return apiError(401, "unauthenticated", "Entre com o Discord para aceitar uma solução.");
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
  const answerId = parseId(body.answerId);
  if (!answerId) {
    return apiError(400, "invalid_answer_id", "O identificador da resposta é inválido.");
  }

  try {
    const question = await env.DB.prepare(
      "SELECT id, author_user_id AS authorUserId, status FROM questions WHERE id = ?",
    ).bind(questionId).first();
    if (!question) {
      return apiError(404, "question_not_found", "A pergunta solicitada não existe.");
    }
    if (question.authorUserId !== user.userId) {
      return apiError(403, "not_question_owner", "Somente quem abriu a pergunta pode aceitar uma solução.");
    }
    if (question.status !== "open") {
      return apiError(409, "question_resolved", "Esta pergunta já possui uma solução aceita.");
    }

    const answer = await env.DB.prepare(
      "SELECT id FROM answers WHERE id = ? AND question_id = ?",
    ).bind(answerId, questionId).first();
    if (!answer) {
      return apiError(404, "answer_not_found", "A resposta não pertence a esta pergunta ou não existe.");
    }

    const updateResult = await env.DB.prepare(`
      UPDATE questions
      SET accepted_answer_id = ?, status = 'resolved', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND author_user_id = ?
        AND status = 'open'
        AND EXISTS (
          SELECT 1 FROM answers
          WHERE answers.id = ? AND answers.question_id = questions.id
        )
    `).bind(answerId, questionId, user.userId, answerId).run();

    if (updateResult.meta?.changes !== 1) {
      return apiError(409, "question_state_changed", "A pergunta mudou de estado. Atualize e tente novamente.");
    }

    const updatedQuestion = await env.DB.prepare(
      "SELECT id, status, accepted_answer_id AS acceptedAnswerId, updated_at AS updatedAt FROM questions WHERE id = ?",
    ).bind(questionId).first();

    return json(updatedQuestion);
  } catch (error) {
    return serverError("PUT /api/questions/:questionId/accepted-answer", error);
  }
}
