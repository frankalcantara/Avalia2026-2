// Fila de estudos diária: cartões vencidos (revisão) + cartões novos até o limite diário.
import { preview } from './sm2.js';

export const NEW_CARDS_PER_DAY = 20; // por baralho, por dia
export const MAX_REVIEWS_IN_QUEUE = 500;

/** Mapa deck_id -> quantidade de cartões novos já estudados hoje. */
export async function newStudiedToday(db, userId, today) {
  const { results } = await db
    .prepare(
      `SELECT deck_id, COUNT(*) AS n FROM reviews
        WHERE user_id = ? AND review_date = ? AND was_new = 1
        GROUP BY deck_id`
    )
    .bind(userId, today)
    .all();
  const map = new Map();
  for (const r of results) map.set(r.deck_id, Number(r.n));
  return map;
}

function toQueueItem(row, isNew) {
  return {
    id: row.id,
    deck_id: row.deck_id,
    deck_name: row.deck_name,
    front: row.front,
    back: row.back,
    is_new: isNew,
    interval_days: row.interval_days,
    ease_factor: row.ease_factor,
    repetitions: row.repetitions,
    due_date: row.due_date,
    preview: preview(row),
  };
}

/**
 * Monta a fila do dia para o estudante. Se deckId for null, considera todos os baralhos.
 */
export async function buildQueue(db, userId, today, deckId = null) {
  const deckFilter = deckId ? ' AND c.deck_id = ?' : '';
  const deckArgs = deckId ? [deckId] : [];
  const cols = `c.id, c.deck_id, d.name AS deck_name, c.front, c.back,
                c.ease_factor, c.interval_days, c.repetitions, c.due_date`;

  const [reviewRes, newRes, studied] = await Promise.all([
    db
      .prepare(
        `SELECT ${cols} FROM cards c JOIN decks d ON d.id = c.deck_id
          WHERE c.user_id = ? AND c.repetitions > 0 AND c.due_date <= ?${deckFilter}
          ORDER BY c.due_date, c.id LIMIT ${MAX_REVIEWS_IN_QUEUE}`
      )
      .bind(userId, today, ...deckArgs)
      .all(),
    db
      .prepare(
        `SELECT * FROM (
           SELECT ${cols}, ROW_NUMBER() OVER (PARTITION BY c.deck_id ORDER BY c.id) AS rn
             FROM cards c JOIN decks d ON d.id = c.deck_id
            WHERE c.user_id = ? AND c.repetitions = 0${deckFilter}
         ) WHERE rn <= ? ORDER BY deck_id, rn`
      )
      .bind(userId, ...deckArgs, NEW_CARDS_PER_DAY)
      .all(),
    newStudiedToday(db, userId, today),
  ]);

  const reviews = reviewRes.results.map((r) => toQueueItem(r, false));
  const fresh = newRes.results
    .filter((r) => r.rn <= NEW_CARDS_PER_DAY - (studied.get(r.deck_id) || 0))
    .map((r) => toQueueItem(r, true));

  return {
    queue: [...reviews, ...fresh],
    counts: { review: reviews.length, new: fresh.length },
  };
}
