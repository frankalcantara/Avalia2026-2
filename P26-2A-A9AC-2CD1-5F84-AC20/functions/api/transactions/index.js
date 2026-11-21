import { json, fail, requireUser, readJson, validateTransaction, ALL_CATEGORIES } from '../../_lib.js';

const LIST_LIMIT = 500;

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const month = params.get('month') || '';
  const category = params.get('category') || '';
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(400, 'Mês inválido.');
  if (category && !ALL_CATEGORIES.includes(category)) return fail(400, 'Categoria inválida.');

  let where = 'user_id = ?';
  const args = [auth.user.id];
  if (month) { where += ' AND substr(date, 1, 7) = ?'; args.push(month); }
  if (category) { where += ' AND category = ?'; args.push(category); }

  const [list, total, chart] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, type, amount_cents, category, description, date FROM transactions WHERE ${where} ORDER BY date DESC, id DESC LIMIT ${LIST_LIMIT}`
    ).bind(...args),
    env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'receita' THEN amount_cents END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount_cents END), 0) AS expense
       FROM transactions WHERE user_id = ?`
    ).bind(auth.user.id),
    env.DB.prepare(
      `SELECT category, SUM(amount_cents) AS total FROM transactions WHERE ${where} AND type = 'despesa' GROUP BY category ORDER BY total DESC`
    ).bind(...args),
  ]);
  const { income, expense } = total.results[0];
  return json({
    items: list.results,
    truncated: list.results.length >= LIST_LIMIT,
    byCategory: chart.results,
    balance: { income, expense, net: income - expense },
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env, true);
  if (auth.response) return auth.response;

  const checked = validateTransaction(await readJson(request));
  if (checked.error) return fail(400, checked.error);
  const t = checked.value;

  const result = await env.DB.prepare(
    'INSERT INTO transactions (user_id, type, amount_cents, category, description, date) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(auth.user.id, t.type, t.amount_cents, t.category, t.description, t.date).run();
  return json({ id: result.meta.last_row_id }, 201);
}
