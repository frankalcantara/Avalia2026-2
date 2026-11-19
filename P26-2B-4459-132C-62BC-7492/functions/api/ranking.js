// GET /api/ranking?categoryId=… — melhor pontuação por usuário (quizzes finalizados), top 10.
import { ID_PATTERN } from '../_lib/config.js';
import { avatarUrl, requireUser } from '../_lib/auth.js';
import { HttpError, handle, json } from '../_lib/http.js';

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(request, env);
  const categoryId = new URL(request.url).searchParams.get('categoryId') ?? '';
  if (!ID_PATTERN.test(categoryId)) throw new HttpError(400, 'invalid_body', 'categoryId inválido.');

  const db = env.DB;
  const category = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId).first();
  if (!category) throw new HttpError(404, 'category_not_found', 'Categoria não encontrada.');

  const { results } = await db
    .prepare(
      'SELECT u.id AS user_id, u.name, u.avatar, MAX(s.score) AS best, COUNT(*) AS games, MIN(s.finished_at) AS first_at ' +
        'FROM quiz_sessions s JOIN users u ON u.id = s.user_id ' +
        "WHERE s.status = 'finished' AND s.category_id = ? " +
        'GROUP BY u.id ORDER BY best DESC, first_at ASC LIMIT 10',
    )
    .bind(categoryId)
    .all();

  const ranking = results.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    avatarUrl: avatarUrl(r.user_id, r.avatar),
    best: r.best,
    games: r.games,
    isMe: r.user_id === user.id,
  }));

  let me = null;
  const mine = await db
    .prepare("SELECT MAX(score) AS best, COUNT(*) AS games FROM quiz_sessions WHERE status = 'finished' AND category_id = ? AND user_id = ?")
    .bind(categoryId, user.id)
    .first();
  if (mine && mine.games > 0) {
    const better = await db
      .prepare(
        'SELECT COUNT(*) AS n FROM (SELECT user_id, MAX(score) AS b FROM quiz_sessions ' +
          "WHERE status = 'finished' AND category_id = ? GROUP BY user_id) WHERE b > ?",
      )
      .bind(categoryId, mine.best)
      .first();
    me = { rank: better.n + 1, best: mine.best, games: mine.games };
  }

  return json({ categoryId, ranking, me });
});
