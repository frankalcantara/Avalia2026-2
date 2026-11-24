import { jsonError, requireSession } from "../_shared/auth.js";
import { getAttempt, getQuestion, parseJson } from "../_shared/quiz.js";

const SAVE_ANSWER_SQL = `
  INSERT INTO quiz_answers (
    attempt_id,
    question_id,
    option_id,
    correct_option_id,
    elapsed_seconds,
    points
  )
  SELECT
    quiz_attempt.id,
    quiz_question.id,
    ?,
    quiz_question.correct_option_id,
    MAX(0, (julianday('now') - julianday(quiz_attempt.issued_at)) * 86400),
    CASE
      WHEN ? <> ''
        AND ? = quiz_question.correct_option_id
        AND (julianday('now') - julianday(quiz_attempt.issued_at)) * 86400
          <= quiz_question.time_limit_seconds
      THEN MAX(
        1,
        CAST(
          100 * (
            quiz_question.time_limit_seconds
            - MAX(0, (julianday('now') - julianday(quiz_attempt.issued_at)) * 86400)
          ) / quiz_question.time_limit_seconds
          AS INTEGER
        )
      )
      ELSE 0
    END
  FROM quiz_attempts AS quiz_attempt
  JOIN quiz_questions AS quiz_question
    ON quiz_question.id = quiz_attempt.current_question_id
  WHERE quiz_attempt.id = ?
    AND quiz_attempt.user_id = ?
    AND quiz_attempt.current_question_id = ?
    AND quiz_attempt.finished_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM quiz_answers AS saved_answer
      WHERE saved_answer.attempt_id = quiz_attempt.id
        AND saved_answer.question_id = quiz_question.id
    )
`;

async function saveAnswer(db, { attemptId, questionId, userId, optionId }) {
  return db
    .prepare(SAVE_ANSWER_SQL)
    .bind(optionId, optionId, optionId, attemptId, userId, questionId)
    .run();
}

async function readSavedAnswer(db, attemptId, questionId) {
  return db
    .prepare(`
      SELECT
        quiz_answer.correct_option_id,
        quiz_answer.points,
        quiz_answer.elapsed_seconds,
        quiz_question.time_limit_seconds
      FROM quiz_answers AS quiz_answer
      JOIN quiz_questions AS quiz_question
        ON quiz_question.id = quiz_answer.question_id
      WHERE quiz_answer.attempt_id = ?
        AND quiz_answer.question_id = ?
    `)
    .bind(attemptId, questionId)
    .first();
}

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (auth.response) return auth.response;

  const { env } = context;
  if (!env.DB) return jsonError("database_unavailable", 503);

  const body = await parseJson(context.request);
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";

  if (!attemptId || !questionId || !["", "a", "b", "c", "d"].includes(optionId)) {
    return jsonError("invalid_answer", 400);
  }

  const attempt = await getAttempt(env.DB, attemptId, auth.user.userId);
  if (!attempt) return jsonError("attempt_not_found", 404);
  if (attempt.finished_at || attempt.current_question_id !== questionId) {
    return jsonError("question_not_current", 409);
  }

  const question = await getQuestion(env.DB, questionId);
  if (!question || question.category_id !== attempt.category_id) {
    return jsonError("question_not_found", 404);
  }

  const saved = await saveAnswer(env.DB, {
    attemptId,
    questionId,
    userId: auth.user.userId,
    optionId,
  });
  if (!saved.meta?.changes) return jsonError("answer_already_submitted", 409);

  const answer = await readSavedAnswer(env.DB, attemptId, questionId);
  await env.DB
    .prepare(`
      UPDATE quiz_attempts
      SET score = score + ?
      WHERE id = ? AND user_id = ? AND current_question_id = ?
    `)
    .bind(Number(answer.points), attemptId, auth.user.userId, questionId)
    .run();

  const updatedAttempt = await getAttempt(env.DB, attemptId, auth.user.userId);
  const timedOut = Number(answer.elapsed_seconds) > Number(answer.time_limit_seconds);
  const correct = Boolean(optionId)
    && optionId === answer.correct_option_id
    && Number(answer.points) > 0;

  return Response.json({
    correct,
    correctOptionId: answer.correct_option_id,
    points: Number(answer.points),
    score: Number(updatedAttempt.score),
    timedOut,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
