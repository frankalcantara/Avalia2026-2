import { jsonError, requireSession } from "../_shared/auth.js";
import {
  countQuestions,
  parseJson,
  toPublicQuestion,
} from "../_shared/quiz.js";

const FIRST_QUESTION_SQL = `
  SELECT
    id,
    category_id,
    prompt,
    option_a,
    option_b,
    option_c,
    option_d,
    time_limit_seconds
  FROM quiz_questions
  WHERE category_id = ?
  ORDER BY sort_order, id
  LIMIT 1
`;

const CREATE_ATTEMPT_SQL = `
  INSERT INTO quiz_attempts (
    id,
    user_id,
    category_id,
    current_question_id,
    question_index,
    score,
    issued_at
  ) VALUES (?, ?, ?, ?, 0, 0, strftime('%Y-%m-%d %H:%M:%f', 'now'))
`;

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (auth.response) return auth.response;

  const { env } = context;
  if (!env.DB) return jsonError("database_unavailable", 503);

  const body = await parseJson(context.request);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  if (!categoryId || categoryId.length > 40) {
    return jsonError("invalid_category", 400);
  }

  const question = await env.DB
    .prepare(FIRST_QUESTION_SQL)
    .bind(categoryId)
    .first();
  if (!question) return jsonError("category_not_found_or_empty", 404);

  const attemptId = crypto.randomUUID();
  await env.DB
    .prepare(CREATE_ATTEMPT_SQL)
    .bind(attemptId, auth.user.userId, categoryId, question.id)
    .run();

  const total = await countQuestions(env.DB, categoryId);
  return Response.json({
    attemptId,
    question: toPublicQuestion(question, 1, total),
  }, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
