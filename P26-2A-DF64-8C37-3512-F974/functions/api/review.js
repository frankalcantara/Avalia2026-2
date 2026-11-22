// POST /api/review — {card_id, rating: "hard" | "good" | "easy", deck_scope?}
//
// Regra de negócio central, executada apenas no servidor:
// 1. o cartão precisa pertencer ao estudante logado;
// 2. o cartão precisa estar na fila de hoje (vencido, ou novo dentro do limite diário);
// 3. o SM-2 simplificado recalcula fator de facilidade, repetições e intervalo em dias;
// 4. a nova data de revisão e o histórico são gravados numa única transação D1 (batch),
//    com UPDATE condicional (anti-duplo-clique / outra aba) e cota de novos dentro do SQL.
import { HttpError, json, nowIso, parseId, readJson } from '../_lib/http.js';
import { addDays, todayFor } from '../_lib/dates.js';
import { isValidRating, schedule } from '../_lib/sm2.js';
import { NEW_CARDS_PER_DAY, buildQueue, newStudiedToday } from '../_lib/queue.js';

export async function onRequestPost({ request, env, data }) {
  const db = env.DB;
  const userId = data.user.id;
  const body = await readJson(request, 4096);

  const cardId = parseId(body.card_id);
  if (!cardId) throw new HttpError(400, 'card_id inválido.', 'invalid_id');
  if (!isValidRating(body.rating)) {
    throw new HttpError(400, 'Avaliação deve ser "hard", "good" ou "easy".', 'invalid_rating');
  }

  const card = await db
    .prepare(
      `SELECT id, deck_id, ease_factor, interval_days, repetitions, due_date, updated_at
         FROM cards WHERE id = ? AND user_id = ?`
    )
    .bind(cardId, userId)
    .first();
  if (!card) throw new HttpError(404, 'Cartão não encontrado.', 'card_not_found');

  const today = todayFor(data);
  const wasNew = card.repetitions === 0;

  // Verificações com mensagens claras (repetidas de forma atômica no UPDATE abaixo).
  if (wasNew) {
    const studied = (await newStudiedToday(db, userId, today)).get(card.deck_id) || 0;
    if (studied >= NEW_CARDS_PER_DAY) {
      throw new HttpError(409, `Limite de ${NEW_CARDS_PER_DAY} cartões novos por dia neste baralho.`, 'new_limit');
    }
  } else if (card.due_date > today) {
    throw new HttpError(409, `Este cartão só volta à fila em ${card.due_date}.`, 'not_due');
  }

  const next = schedule(card, body.rating);
  const dueDate = addDays(today, next.interval_days);
  const now = nowIso();

  const [update] = await db.batch([
    db
      .prepare(
        `UPDATE cards
            SET ease_factor = ?, interval_days = ?, repetitions = ?, due_date = ?,
                last_reviewed_at = ?, updated_at = ?
          WHERE id = ? AND user_id = ? AND repetitions = ? AND updated_at = ?
            AND (repetitions > 0 OR (
                  SELECT COUNT(*) FROM reviews
                   WHERE user_id = ? AND deck_id = ? AND review_date = ? AND was_new = 1
                ) < ?)`
      )
      .bind(next.ease_factor, next.interval_days, next.repetitions, dueDate, now, now,
        card.id, userId, card.repetitions, card.updated_at,
        userId, card.deck_id, today, NEW_CARDS_PER_DAY),
    // Só registra o histórico se o UPDATE acima realmente aconteceu (mesmo updated_at/repetitions).
    db
      .prepare(
        `INSERT INTO reviews (card_id, deck_id, user_id, rating, quality, was_new,
                              prev_interval, new_interval, prev_ease, new_ease, review_date, reviewed_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM cards
                         WHERE id = ? AND user_id = ? AND updated_at = ? AND repetitions = ?)`
      )
      .bind(card.id, card.deck_id, userId, body.rating, next.quality, wasNew ? 1 : 0,
        card.interval_days, next.interval_days, card.ease_factor, next.ease_factor, today, now,
        card.id, userId, now, next.repetitions),
  ]);

  if (!update.meta || update.meta.changes !== 1) {
    throw new HttpError(409, 'Este cartão acabou de ser avaliado em outra janela.', 'conflict');
  }

  const scope = parseId(body.deck_scope) || null;
  const { counts } = await buildQueue(db, userId, today, scope);

  return json({
    card: {
      id: card.id,
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_date: dueDate,
    },
    remaining: counts,
  });
}
