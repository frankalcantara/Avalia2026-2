import {
  apiError,
  json,
  missingDatabase,
  parseId,
  serverError,
} from "../../_shared/http.js";

export async function onRequestGet({ env, params }) {
  if (!env.DB) {
    return missingDatabase();
  }

  const questionId = parseId(params.questionId);
  if (!questionId) {
    return apiError(400, "invalid_question_id", "O identificador da pergunta é inválido.");
  }

  try {
    const question = await env.DB.prepare(`
      SELECT
        q.id,
        q.title,
        q.content,
        q.author_user_id AS authorUserId,
        u.username AS authorUsername,
        u.avatar AS authorAvatar,
        q.status,
        q.accepted_answer_id AS acceptedAnswerId,
        q.created_at AS createdAt,
        q.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answerCount
      FROM questions q
      JOIN discord_users u ON u.user_id = q.author_user_id
      WHERE q.id = ?
    `).bind(questionId).first();

    if (!question) {
      return apiError(404, "question_not_found", "A pergunta solicitada não existe.");
    }

    const answersResult = await env.DB.prepare(`
      SELECT
        a.id,
        a.question_id AS questionId,
        a.content,
        a.author_user_id AS authorUserId,
        u.username AS authorUsername,
        u.avatar AS authorAvatar,
        a.created_at AS createdAt,
        CASE WHEN a.id = ? THEN 1 ELSE 0 END AS accepted
      FROM answers a
      JOIN discord_users u ON u.user_id = a.author_user_id
      WHERE a.question_id = ?
      ORDER BY accepted DESC, a.created_at ASC, a.id ASC
    `).bind(question.acceptedAnswerId, questionId).all();

    return json({
      id: question.id,
      title: question.title,
      content: question.content,
      author: {
        userId: question.authorUserId,
        username: question.authorUsername,
        avatar: question.authorAvatar,
      },
      status: question.status,
      acceptedAnswerId: question.acceptedAnswerId,
      answerCount: Number(question.answerCount),
      createdAt: question.createdAt,
      answers: (answersResult.results || []).map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        content: answer.content,
        author: {
          userId: answer.authorUserId,
          username: answer.authorUsername,
          avatar: answer.authorAvatar,
        },
        accepted: Boolean(answer.accepted),
        createdAt: answer.createdAt,
      })),
    });
  } catch (error) {
    return serverError("GET /api/questions/:questionId", error);
  }
}
