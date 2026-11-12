export const TIME_LIMIT_SECONDS = 20;

export async function parseJson(request) {
  try { return await request.json(); } catch { return null; }
}

export async function getAttempt(db, attemptId, userId) {
  return db.prepare("SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ?").bind(attemptId, userId).first();
}

export async function getQuestion(db, questionId) {
  return db.prepare("SELECT id, category_id, prompt, option_a, option_b, option_c, option_d, sort_order FROM quiz_questions WHERE id = ?").bind(questionId).first();
}

export function publicQuestion(question, total) {
  return {
    id: question.id,
    prompt: question.prompt,
    options: ["a", "b", "c", "d"].map(id => ({ id, text: question[`option_${id}`] })),
    position: Number(question.question_index) + 1,
    total,
    timeLimitSeconds: TIME_LIMIT_SECONDS,
  };
}

export async function countQuestions(db, categoryId) {
  const row = await db.prepare("SELECT COUNT(*) AS total FROM quiz_questions WHERE category_id = ?").bind(categoryId).first();
  return Number(row?.total || 0);
}
