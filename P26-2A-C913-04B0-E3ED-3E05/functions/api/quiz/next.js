import { requireSession, jsonError } from "../_shared/auth.js";
import { getAttempt, TIME_LIMIT_SECONDS } from "../_shared/quiz.js";

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (auth.response) return auth.response;
  const { env } = context;
  if (!env.DB) return jsonError("database_unavailable", 503);
  let body;
  try { body = (await context.request.json()) || {}; } catch { body = {}; }
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  const attempt = await getAttempt(env.DB, attemptId, auth.user.userId);
  if (!attempt) return jsonError("attempt_not_found", 404);
  if (attempt.finished_at) return jsonError("attempt_finished", 409);
  const answered = await env.DB.prepare("SELECT 1 FROM quiz_answers WHERE attempt_id = ? AND question_id = ?").bind(attemptId, attempt.current_question_id).first();
  if (!answered) return jsonError("answer_required", 409);
  const questions = await env.DB.prepare("SELECT id, prompt, option_a, option_b, option_c, option_d, time_limit_seconds, sort_order FROM quiz_questions WHERE category_id = ? ORDER BY sort_order, id").bind(attempt.category_id).all();
  const nextIndex = Number(attempt.question_index) + 1;
  const total = questions.results?.length || 0;
  if (nextIndex >= total) {
    await env.DB.prepare("UPDATE quiz_attempts SET finished_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND finished_at IS NULL").bind(attemptId, auth.user.userId).run();
    const fresh = await getAttempt(env.DB, attemptId, auth.user.userId);
    return Response.json({ complete: true, score: Number(fresh.score), answered: total, total }, { headers: { "Cache-Control": "no-store" } });
  }
  const nextQuestion = questions.results[nextIndex];
  const updated = await env.DB.prepare("UPDATE quiz_attempts SET current_question_id = ?, question_index = ?, issued_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ? AND user_id = ? AND current_question_id = ? AND finished_at IS NULL").bind(nextQuestion.id, nextIndex, attemptId, auth.user.userId, attempt.current_question_id).run();
  if (!updated.meta?.changes) return jsonError("question_state_changed", 409);
  return Response.json({ question: {
    id: nextQuestion.id,
    prompt: nextQuestion.prompt,
    options: ["a", "b", "c", "d"].map(optionId => ({ id: optionId, text: nextQuestion[`option_${optionId}`] })),
    position: nextIndex + 1,
    total,
    timeLimitSeconds: Number(nextQuestion.time_limit_seconds || TIME_LIMIT_SECONDS),
  } }, { headers: { "Cache-Control": "no-store" } });
}
