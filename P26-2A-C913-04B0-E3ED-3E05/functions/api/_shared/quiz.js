export const TIME_LIMIT_SECONDS = 20;

const OPTION_IDS = ["a", "b", "c", "d"];

const GET_ATTEMPT_SQL = `
  SELECT *
  FROM quiz_attempts
  WHERE id = ? AND user_id = ?
`;

const GET_QUESTION_SQL = `
  SELECT
    id,
    category_id,
    prompt,
    option_a,
    option_b,
    option_c,
    option_d,
    sort_order
  FROM quiz_questions
  WHERE id = ?
`;

const COUNT_QUESTIONS_SQL = `
  SELECT COUNT(*) AS total
  FROM quiz_questions
  WHERE category_id = ?
`;

export async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function getAttempt(db, attemptId, userId) {
  return db
    .prepare(GET_ATTEMPT_SQL)
    .bind(attemptId, userId)
    .first();
}

export function getQuestion(db, questionId) {
  return db
    .prepare(GET_QUESTION_SQL)
    .bind(questionId)
    .first();
}

export function toPublicQuestion(question, position, total) {
  const options = OPTION_IDS.map((id) => ({
    id,
    text: question[`option_${id}`],
  }));

  return {
    id: question.id,
    prompt: question.prompt,
    options,
    position,
    total,
    timeLimitSeconds:
      Number(question.time_limit_seconds) || TIME_LIMIT_SECONDS,
  };
}

export async function countQuestions(db, categoryId) {
  const row = await db
    .prepare(COUNT_QUESTIONS_SQL)
    .bind(categoryId)
    .first();

  return Number(row?.total || 0);
}
