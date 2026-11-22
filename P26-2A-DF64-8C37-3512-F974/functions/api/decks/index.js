// GET  /api/decks — lista os baralhos do estudante com contagens da fila de hoje.
// POST /api/decks — cria um baralho.
import { HttpError, json, nowIso, readJson } from '../../_lib/http.js';
import { LIMITS, validateDeckInput } from '../../_lib/validate.js';
import { todayFor } from '../../_lib/dates.js';
import { NEW_CARDS_PER_DAY, newStudiedToday } from '../../_lib/queue.js';

export async function onRequestGet({ env, data }) {
  const userId = data.user.id;
  const today = todayFor(data);
  const [{ results }, studied] = await Promise.all([
    env.DB.prepare(
      `SELECT d.id, d.name, d.description, d.created_at,
              COUNT(c.id) AS total,
              COALESCE(SUM(CASE WHEN c.repetitions > 0 AND c.due_date <= ?1 THEN 1 ELSE 0 END), 0) AS due,
              COALESCE(SUM(CASE WHEN c.repetitions = 0 THEN 1 ELSE 0 END), 0) AS new_total,
              MIN(CASE WHEN c.repetitions > 0 THEN c.due_date END) AS next_due
         FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
        WHERE d.user_id = ?2
        GROUP BY d.id
        ORDER BY d.created_at DESC, d.id DESC`
    )
      .bind(today, userId)
      .all(),
    newStudiedToday(env.DB, userId, today),
  ]);

  const decks = results.map((d) => {
    const allowance = Math.max(0, NEW_CARDS_PER_DAY - (studied.get(d.id) || 0));
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.created_at,
      total: Number(d.total),
      due: Number(d.due),
      new_total: Number(d.new_total),
      new_today: Math.min(Number(d.new_total), allowance),
      next_due: d.next_due,
    };
  });
  return json({ today, new_per_day: NEW_CARDS_PER_DAY, decks });
}

export async function onRequestPost({ request, env, data }) {
  const userId = data.user.id;
  const { name, description } = validateDeckInput(await readJson(request));

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM decks WHERE user_id = ?').bind(userId).first();
  if (Number(count.n) >= LIMITS.DECKS_PER_USER) {
    throw new HttpError(409, `Limite de ${LIMITS.DECKS_PER_USER} baralhos atingido.`, 'deck_limit');
  }

  const now = nowIso();
  const deck = await env.DB.prepare(
    `INSERT INTO decks (user_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?) RETURNING id, name, description, created_at`
  )
    .bind(userId, name, description, now, now)
    .first();
  return json({ deck }, 201);
}
