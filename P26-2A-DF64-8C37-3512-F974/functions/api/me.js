// GET /api/me — perfil do Discord + estatísticas do dia.
import { json } from '../_lib/http.js';
import { avatarUrl } from '../_lib/session.js';
import { addDays, todayFor } from '../_lib/dates.js';
import { buildQueue } from '../_lib/queue.js';

export async function onRequestGet({ env, data }) {
  const user = data.user;
  const db = env.DB;
  const today = todayFor(data);

  const [totals, reviewedToday, days, queue] = await Promise.all([
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM decks WHERE user_id = ?1) AS decks,
                (SELECT COUNT(*) FROM cards WHERE user_id = ?1) AS cards`
      )
      .bind(user.id)
      .first(),
    db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE user_id = ? AND review_date = ?').bind(user.id, today).first(),
    db
      .prepare('SELECT DISTINCT review_date AS d FROM reviews WHERE user_id = ? ORDER BY review_date DESC LIMIT 400')
      .bind(user.id)
      .all(),
    buildQueue(db, user.id, today),
  ]);

  // Sequência de dias consecutivos com estudo (conta a partir de hoje ou de ontem).
  const set = new Set(days.results.map((r) => r.d));
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.global_name || user.username,
      avatar_url: avatarUrl(user),
    },
    today,
    timezone: data.tz,
    stats: {
      decks: Number(totals?.decks) || 0,
      cards: Number(totals?.cards) || 0,
      due_today: queue.counts.review,
      new_today: queue.counts.new,
      reviewed_today: Number(reviewedToday?.n) || 0,
      streak,
    },
  });
}
