import { getUser, json, unauthorized, clean, now } from '../_lib.js';
export async function onRequestGet(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const deck = Number(new URL(ctx.request.url).searchParams.get('deck_id'));
  const { results } = await ctx.env.DB.prepare(
    'SELECT id, front, back, interval_days, due_at FROM cards WHERE deck_id = ? AND user_id = ? ORDER BY id DESC')
    .bind(deck, u.id).all();
  return json(results);
}
export async function onRequestPost(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const b = (await ctx.request.json().catch(() => null)) || {};
  const front = clean(b.front, 500), back = clean(b.back, 1000);
  if (!front || !back) return json({ error: 'Preencha frente e verso' }, 400);
  const deck = await ctx.env.DB.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?')
    .bind(Number(b.deck_id), u.id).first();
  if (!deck) return json({ error: 'Baralho não encontrado' }, 404);
  const r = await ctx.env.DB.prepare(
    'INSERT INTO cards (deck_id, user_id, front, back, due_at) VALUES (?, ?, ?, ?, ?)')
    .bind(deck.id, u.id, front, back, now()).run();
  return json({ id: r.meta.last_row_id }, 201);
}
export async function onRequestDelete(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const id = Number(new URL(ctx.request.url).searchParams.get('id'));
  await ctx.env.DB.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?').bind(id, u.id).run();
  return json({ ok: true });
}