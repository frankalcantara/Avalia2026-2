// GET  /api/decks/:id/cards — lista os cartões do baralho.
// POST /api/decks/:id/cards — adiciona um cartão ({front, back}) ou vários ({cards: [...]}).
import { HttpError, json, nowIso, readJson } from '../../../_lib/http.js';
import { LIMITS, validateCardBatch } from '../../../_lib/validate.js';
import { todayFor } from '../../../_lib/dates.js';
import { loadDeck } from '../../../_lib/decks.js';

const CARD_COLS = `id, deck_id, front, back, ease_factor, interval_days, repetitions,
                   due_date, last_reviewed_at, created_at, updated_at`;

export async function onRequestGet({ env, params, data }) {
  const deck = await loadDeck(env.DB, data.user.id, params.id);
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM cards WHERE deck_id = ? AND user_id = ? ORDER BY id DESC`
  )
    .bind(deck.id, data.user.id)
    .all();
  return json({ today: todayFor(data), deck, cards: results });
}

export async function onRequestPost({ request, env, params, data }) {
  const db = env.DB;
  const userId = data.user.id;
  const deck = await loadDeck(db, userId, params.id);
  const cards = validateCardBatch(await readJson(request));

  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM cards WHERE deck_id = ? AND user_id = ?')
    .bind(deck.id, userId)
    .first();
  if (Number(count.n) + cards.length > LIMITS.CARDS_PER_DECK) {
    throw new HttpError(409, `Um baralho pode ter no máximo ${LIMITS.CARDS_PER_DECK} cartões.`, 'card_limit');
  }

  const now = nowIso();
  const today = todayFor(data);
  const inserted = await db.batch(
    cards.map((c) =>
      db
        .prepare(
          `INSERT INTO cards (deck_id, user_id, front, back, due_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${CARD_COLS}`
        )
        .bind(deck.id, userId, c.front, c.back, today, now, now)
    )
  );
  await db.prepare('UPDATE decks SET updated_at = ? WHERE id = ? AND user_id = ?').bind(now, deck.id, userId).run();

  return json({ cards: inserted.map((r) => r.results[0]) }, 201);
}
