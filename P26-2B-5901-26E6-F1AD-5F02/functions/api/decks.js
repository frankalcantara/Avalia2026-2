import { getUser, json, unauthorized, clean, now } from '../_lib.js';
export async function onRequestGet(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const { results } = await ctx.env.DB.prepare(
    `SELECT d.id, d.name, COUNT(c.id) AS total,
            COALESCE(SUM(CASE WHEN c.due_at <= ? THEN 1 ELSE 0 END), 0) AS due
     FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
     WHERE d.user_id = ? GROUP BY d.id ORDER BY d.id DESC`).bind(now(), u.id).all();
  return json(results);
}
export async function onRequestPost(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const body = await ctx.request.json().catch(() => ({}));
  const name = clean(body.name, 80);
  if (!name) return json({ error: 'Informe o nome do baralho' }, 400);
  const r = await ctx.env.DB.prepare('INSERT INTO decks (user_id, name, created_at) VALUES (?, ?, ?)')
    .bind(u.id, name, now()).run();
  return json({ id: r.meta.last_row_id, name }, 201);
}
export async function onRequestDelete(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const id = Number(new URL(ctx.request.url).searchParams.get('id'));
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('DELETE FROM cards WHERE deck_id = ? AND user_id = ?').bind(id, u.id),
    ctx.env.DB.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').bind(id, u.id)]);
  return json({ ok: true });
}
