// POST /api/quiz/answer — o servidor mede o tempo (recebimento − sent_at no D1) e atribui a pontuação.
import { GRACE_MS } from '../../_lib/config.js';
import { requireUser } from '../../_lib/auth.js';
import { HttpError, handle, json, readJson } from '../../_lib/http.js';
import { closeItem, finishIfDone, loadQuiz, parseQuizId, syncScore } from '../../_lib/quiz.js';
import { computePoints } from '../../_lib/scoring.js';

export const onRequestPost = handle(
  async ({ request, env }) => {
    const receivedAt = Date.now(); // relógio oficial: capturado antes de qualquer outra operação
    const user = await requireUser(request, env);
    const body = await readJson(request);
    const quizId = parseQuizId(body.quizId);
    const { position, choice } = body;

    if (!Number.isInteger(position) || position < 0 || position > 99) {
      throw new HttpError(400, 'invalid_body', 'position inválida.');
    }
    if (choice !== null && !(Number.isInteger(choice) && choice >= 0 && choice <= 3)) {
      throw new HttpError(400, 'invalid_body', 'choice deve ser 0–3 ou null.');
    }

    const db = env.DB;
    const quiz = await loadQuiz(db, quizId, user.id);
    if (quiz.status !== 'active') throw new HttpError(409, 'quiz_not_active', 'Este quiz não está ativo.');

    const item = await db
      .prepare(
        'SELECT i.option_order, i.time_limit_ms, i.sent_at, i.answered_at, q.correct_index ' +
          'FROM quiz_items i JOIN questions q ON q.id = i.question_id ' +
          'WHERE i.quiz_id = ? AND i.position = ?',
      )
      .bind(quizId, position)
      .first();
    if (!item) throw new HttpError(404, 'question_not_found', 'Pergunta não encontrada.');
    if (item.answered_at !== null) throw new HttpError(409, 'already_answered', 'Pergunta já respondida.');
    if (item.sent_at === null) throw new HttpError(409, 'not_sent', 'Esta pergunta ainda não foi entregue.');

    const limit = item.time_limit_ms;
    const elapsed = Math.max(0, receivedAt - item.sent_at);
    const order = JSON.parse(item.option_order);
    const late = elapsed > limit + GRACE_MS;

    let result;
    let points = 0;
    if (late) {
      result = 'timeout'; // resposta fora do tempo: bloqueada, 0 ponto
    } else if (choice === null) {
      result = elapsed >= limit ? 'timeout' : 'skipped';
    } else if (order[choice] === item.correct_index) {
      result = 'correct';
      points = computePoints(elapsed, limit);
    } else {
      result = 'wrong';
    }

    // UPDATE condicional (answered_at IS NULL): em envios concorrentes só um é gravado.
    const stored = await closeItem(db, quizId, position, { now: receivedAt, chosen: choice, result, elapsed, points });
    if (!stored) throw new HttpError(409, 'already_answered', 'Pergunta já respondida.');

    await syncScore(db, quizId);
    const finished = await finishIfDone(db, quizId, receivedAt);
    const stats = await db
      .prepare(
        'SELECT (SELECT COUNT(*) FROM quiz_items WHERE quiz_id = ? AND answered_at IS NOT NULL) AS answered, ' +
          '(SELECT score FROM quiz_sessions WHERE id = ?) AS score',
      )
      .bind(quizId, quizId)
      .first();

    const reveal = result === 'correct' || result === 'wrong';
    return json(
      {
        accepted: result !== 'timeout',
        result,
        correctIndex: reveal ? order.indexOf(item.correct_index) : null,
        points,
        elapsedMs: elapsed,
        score: stats.score,
        answered: stats.answered,
        total: quiz.total,
        finished,
      },
      late && choice !== null ? 408 : 200,
    );
  },
  { post: true },
);
