import { getUser, json, unauthorized, now } from '../../_lib.js';
const DAILY_LIMIT = 50;
export async function onRequestGet(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const deck = Number(new URL(ctx.request.url).searchParams.get('deck_id'));
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, front, back FROM cards WHERE user_id = ? AND deck_id = ? AND due_at <= ?
     ORDER BY due_at ASC LIMIT ?`).bind(u.id, deck, now(), DAILY_LIMIT).all();
  return json(results);
}
