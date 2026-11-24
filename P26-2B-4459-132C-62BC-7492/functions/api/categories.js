// GET /api/categories — categorias temáticas com a quantidade de questões.
import { requireUser } from '../_lib/auth.js';
import { handle, json } from '../_lib/http.js';

export const onRequestGet = handle(async ({ request, env }) => {
  await requireUser(request, env);
  const { results } = await env.DB
    .prepare(
      'SELECT c.id, c.name, c.description, COUNT(q.id) AS questionCount ' +
        'FROM categories c LEFT JOIN questions q ON q.category_id = c.id ' +
        'GROUP BY c.id ORDER BY c.name',
    )
    .all();
  return json({ categories: results });
});
