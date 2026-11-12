import { requireSession, jsonError } from "../_shared/auth.js";
import { parseJson, countQuestions, TIME_LIMIT_SECONDS } from "../_shared/quiz.js";

function id() {
  return crypto.randomUUID();
}

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (auth.response) return auth.response;
  const { env } = context;
  if (!env.DB) return jsonError("database_unavailable", 503);
  const body = await parseJson(context.request);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  if (!categoryId || categoryId.length > 40) return jsonError("invalid_category", 400);
  const question = await env.DB.prepare("SELECT id, category_id, prompt, option_a, option_b, option_c, option_d, time_limit_seconds FROM quiz_questions WHERE category_id = ? ORDER BY sort_order, id LIMIT 1").bind(categoryId).first();
  if (!question) return jsonError("category_not_found_or_empty", 404);
  const attemptId = id();
  await env.DB.prepare("INSERT INTO quiz_attempts (id, user_id, category_id, current_question_id, question_index, score, issued_at) VALUES (?, ?, ?, ?, 0, 0, strftime('%Y-%m-%d %H:%M:%f', 'now'))").bind(attemptId, auth.user.userId, categoryId, question.id).run();
  const total = await countQuestions(env.DB, categoryId);
  return Response.json({ attemptId, question: { id: question.id, prompt: question.prompt, options: ["a", "b", "c", "d"].map(optionId => ({ id: optionId, text: question[`option_${optionId}`] })), position: 1, total, timeLimitSeconds: Number(question.time_limit_seconds || TIME_LIMIT_SECONDS) } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
