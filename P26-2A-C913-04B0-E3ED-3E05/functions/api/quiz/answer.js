import { requireSession, jsonError } from "../_shared/auth.js";
import { parseJson, getAttempt, getQuestion } from "../_shared/quiz.js";

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (auth.response) return auth.response;
  const { env } = context;
  if (!env.DB) return jsonError("database_unavailable", 503);
  const body = await parseJson(context.request);
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!questionId || !["", "a", "b", "c", "d"].includes(optionId)) return jsonError("invalid_answer", 400);
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const attempt = await getAttempt(env.DB, attemptId, auth.user.userId);
  if (!attempt) return jsonError("attempt_not_found", 404);
  if (attempt.finished_at || attempt.current_question_id !== questionId) return jsonError("question_not_current", 409);
  const question = await getQuestion(env.DB, questionId);
  if (!question || question.category_id !== attempt.category_id) return jsonError("question_not_found", 404);
  const write = await env.DB.prepare(`
    INSERT INTO quiz_answers (attempt_id, question_id, option_id, correct_option_id, elapsed_seconds, points)
    SELECT a.id, q.id, ?, q.correct_option_id,
      MAX(0, (julianday('now') - julianday(a.issued_at)) * 86400),
      CASE WHEN ? <> '' AND ? = q.correct_option_id AND (julianday('now') - julianday(a.issued_at)) * 86400 <= q.time_limit_seconds
        THEN MAX(1, CAST(100 * (q.time_limit_seconds - MAX(0, (julianday('now') - julianday(a.issued_at)) * 86400)) / q.time_limit_seconds AS INTEGER)) ELSE 0 END
    FROM quiz_attempts a JOIN quiz_questions q ON q.id = a.current_question_id
    WHERE a.id = ? AND a.user_id = ? AND a.current_question_id = ? AND a.finished_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM quiz_answers r WHERE r.attempt_id = a.id AND r.question_id = q.id)
  `).bind(optionId, optionId, optionId, attemptId, auth.user.userId, questionId).run();
  if (!write.meta?.changes) return jsonError("answer_already_submitted", 409);
  const answer = await env.DB.prepare("SELECT a.correct_option_id, a.points, a.elapsed_seconds, q.time_limit_seconds FROM quiz_answers a JOIN quiz_questions q ON q.id = a.question_id WHERE a.attempt_id = ? AND a.question_id = ?").bind(attemptId, questionId).first();
  await env.DB.prepare("UPDATE quiz_attempts SET score = score + ? WHERE id = ? AND user_id = ? AND current_question_id = ?").bind(Number(answer.points), attemptId, auth.user.userId, questionId).run();
  const updated = await getAttempt(env.DB, attemptId, auth.user.userId);
  return Response.json({ correct: Boolean(optionId) && optionId === answer.correct_option_id && Number(answer.points) > 0, correctOptionId: answer.correct_option_id, points: Number(answer.points), score: Number(updated.score), timedOut: Number(answer.elapsed_seconds) > Number(answer.time_limit_seconds) }, { headers: { "Cache-Control": "no-store" } });
}
