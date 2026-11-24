// Operações compartilhadas sobre quizzes (todas as regras de estado ficam no servidor).
import { HttpError } from './http.js';
import { QUIZ_ID_PATTERN } from './config.js';

export function parseQuizId(value) {
  if (typeof value !== 'string' || !QUIZ_ID_PATTERN.test(value)) {
    throw new HttpError(400, 'invalid_body', 'quizId inválido.');
  }
  return value;
}

/** Carrega o quiz garantindo que pertence ao usuário autenticado. */
export async function loadQuiz(db, quizId, userId) {
  const quiz = await db
    .prepare('SELECT id, user_id, category_id, total, score, status FROM quiz_sessions WHERE id = ? AND user_id = ?')
    .bind(quizId, userId)
    .first();
  if (!quiz) throw new HttpError(404, 'quiz_not_found', 'Quiz não encontrado.');
  return quiz;
}

/** Encerra um item em aberto. O UPDATE condicional garante que só uma resposta vale. */
export async function closeItem(db, quizId, position, { now, chosen, result, elapsed, points }) {
  const res = await db
    .prepare(
      'UPDATE quiz_items SET answered_at = ?, chosen_index = ?, result = ?, elapsed_ms = ?, points = ? ' +
        'WHERE quiz_id = ? AND position = ? AND answered_at IS NULL',
    )
    .bind(now, chosen ?? null, result, elapsed, points, quizId, position)
    .run();
  return res.meta.changes === 1;
}

/** A pontuação do quiz é sempre derivada dos itens (nunca confiada a um valor incremental). */
export async function syncScore(db, quizId) {
  await db
    .prepare('UPDATE quiz_sessions SET score = (SELECT COALESCE(SUM(points), 0) FROM quiz_items WHERE quiz_id = ?) WHERE id = ?')
    .bind(quizId, quizId)
    .run();
}

export async function finishIfDone(db, quizId, now) {
  const row = await db
    .prepare('SELECT COUNT(*) AS open FROM quiz_items WHERE quiz_id = ? AND answered_at IS NULL')
    .bind(quizId)
    .first();
  if (row.open > 0) return false;
  await db
    .prepare(
      "UPDATE quiz_sessions SET status = 'finished', finished_at = ?, " +
        'score = (SELECT COALESCE(SUM(points), 0) FROM quiz_items WHERE quiz_id = ?) ' +
        "WHERE id = ? AND status = 'active'",
    )
    .bind(now, quizId, quizId)
    .run();
  return true;
}

/** Resumo final com revisão (o gabarito só é revelado aqui, com o quiz encerrado). */
export async function buildSummary(db, quizId) {
  const { results } = await db
    .prepare(
      'SELECT i.position, i.option_order, i.chosen_index, i.result, i.points, i.elapsed_ms, ' +
        'q.text, q.options, q.correct_index ' +
        'FROM quiz_items i JOIN questions q ON q.id = i.question_id ' +
        'WHERE i.quiz_id = ? ORDER BY i.position',
    )
    .bind(quizId)
    .all();
  let score = 0;
  let correctCount = 0;
  const review = results.map((r) => {
    const order = JSON.parse(r.option_order);
    const options = JSON.parse(r.options);
    score += r.points;
    if (r.result === 'correct') correctCount++;
    return {
      number: r.position + 1,
      text: r.text,
      options: order.map((i) => options[i]),
      correctIndex: order.indexOf(r.correct_index),
      chosenIndex: r.chosen_index,
      result: r.result,
      points: r.points,
      elapsedMs: r.elapsed_ms,
    };
  });
  const total = results.length;
  return { score, correctCount, total, accuracy: total ? correctCount / total : 0, review };
}
