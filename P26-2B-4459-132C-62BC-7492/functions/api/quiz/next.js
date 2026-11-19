// POST /api/quiz/next — entrega UMA pergunta (sem gabarito) e inicia o cronômetro oficial no D1.
import { requireUser } from '../../_lib/auth.js';
import { HttpError, handle, json, readJson } from '../../_lib/http.js';
import { buildSummary, closeItem, finishIfDone, loadQuiz, parseQuizId } from '../../_lib/quiz.js';

export const onRequestPost = handle(
  async ({ request, env }) => {
    const user = await requireUser(request, env);
    const body = await readJson(request);
    const quizId = parseQuizId(body.quizId);
    const db = env.DB;

    const quiz = await loadQuiz(db, quizId, user.id);
    if (quiz.status === 'abandoned') throw new HttpError(409, 'quiz_abandoned', 'Este quiz foi abandonado.');
    if (quiz.status === 'finished') return json({ done: true, summary: await buildSummary(db, quizId) });

    for (let guard = 0; guard < 50; guard++) {
      const now = Date.now();
      const item = await db
        .prepare(
          'SELECT i.position, i.option_order, i.time_limit_ms, i.sent_at, q.text, q.options ' +
            'FROM quiz_items i JOIN questions q ON q.id = i.question_id ' +
            'WHERE i.quiz_id = ? AND i.answered_at IS NULL ORDER BY i.position LIMIT 1',
        )
        .bind(quizId)
        .first();

      if (!item) {
        await finishIfDone(db, quizId, now);
        return json({ done: true, summary: await buildSummary(db, quizId) });
      }

      // Primeira entrega: grava sent_at. UPDATE condicional + releitura evita corrida entre abas.
      let sentAt = item.sent_at;
      if (sentAt === null) {
        await db
          .prepare('UPDATE quiz_items SET sent_at = ? WHERE quiz_id = ? AND position = ? AND sent_at IS NULL')
          .bind(now, quizId, item.position)
          .run();
        const stored = await db
          .prepare('SELECT sent_at FROM quiz_items WHERE quiz_id = ? AND position = ?')
          .bind(quizId, item.position)
          .first();
        sentAt = stored.sent_at;
      }

      const elapsed = Math.max(0, now - sentAt);
      if (elapsed >= item.time_limit_ms) {
        // Tempo esgotado sem resposta: encerra como timeout e passa para a próxima.
        await closeItem(db, quizId, item.position, { now, chosen: null, result: 'timeout', elapsed, points: 0 });
        continue;
      }

      const order = JSON.parse(item.option_order);
      const options = JSON.parse(item.options);
      return json({
        done: false,
        question: {
          quizId,
          position: item.position,
          number: item.position + 1,
          total: quiz.total,
          text: item.text,
          options: order.map((i) => options[i]),
          timeLimitMs: item.time_limit_ms,
          remainingMs: item.time_limit_ms - elapsed,
          score: quiz.score,
        },
      });
    }
    throw new HttpError(500, 'internal', 'Não foi possível avançar o quiz.');
  },
  { post: true },
);
