import { jsonError, requireSession } from "../_shared/auth.js";
import { getAttempt, toPublicQuestion } from "../_shared/quiz.js";

const ANSWER_EXISTS_SQL = `
  SELECT 1
  FROM quiz_answers
  WHERE attempt_id = ? AND question_id = ?
`;

const CATEGORY_QUESTIONS_SQL = `
  SELECT
    id,
    prompt,
    option_a,
    option_b,
    option_c,
    option_d,
    time_limit_seconds,
    sort_order
  FROM quiz_questions
  WHERE category_id = ?
  ORDER BY sort_order, id
`;

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (auth.response) return auth.response;

  const { env } = context;
  if (!env.DB) return jsonError("database_unavailable", 503);

  const body = await context.request.json().catch(() => ({}));
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const attempt = await getAttempt(env.DB, attemptId, auth.user.userId);

  if (!attempt) return jsonError("attempt_not_found", 404);
  if (attempt.finished_at) return jsonError("attempt_finished", 409);

  const answered = await env.DB
    .prepare(ANSWER_EXISTS_SQL)
    .bind(attemptId, attempt.current_question_id)
    .first();
  if (!answered) return jsonError("answer_required", 409);

  const questionResult = await env.DB
    .prepare(CATEGORY_QUESTIONS_SQL)
    .bind(attempt.category_id)
    .all();
  const questions = questionResult.results || [];
  const nextIndex = Number(attempt.question_index) + 1;
  const total = questions.length;

  if (nextIndex >= total) {
    return finishAttempt(env.DB, attemptId, auth.user.userId, total);
  }

  const nextQuestion = questions[nextIndex];
  const updated = await issueNextQuestion({
    db: env.DB,
    attempt,
    attemptId,
    question: nextQuestion,
    questionIndex: nextIndex,
    userId: auth.user.userId,
  });
  if (!updated.meta?.changes) return jsonError("question_state_changed", 409);

  return Response.json({
    question: toPublicQuestion(nextQuestion, nextIndex + 1, total),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function finishAttempt(db, attemptId, userId, total) {
  await db
    .prepare(`
      UPDATE quiz_attempts
      SET finished_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND finished_at IS NULL
    `)
    .bind(attemptId, userId)
    .run();

  const attempt = await getAttempt(db, attemptId, userId);
  return Response.json({
    complete: true,
    score: Number(attempt.score),
    answered: total,
    total,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function issueNextQuestion({
  db,
  attempt,
  attemptId,
  question,
  questionIndex,
  userId,
}) {
  return db
    .prepare(`
      UPDATE quiz_attempts
      SET current_question_id = ?,
          question_index = ?,
          issued_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
      WHERE id = ?
        AND user_id = ?
        AND current_question_id = ?
        AND finished_at IS NULL
    `)
    .bind(
      question.id,
      questionIndex,
      attemptId,
      userId,
      attempt.current_question_id,
    )
    .run();
}
