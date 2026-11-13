import { getUser, json, unauthorized, sm2, now, DAY } from '../../_lib.js';
const RATINGS = ['dificil', 'bom', 'facil'];
export async function onRequestPost(ctx) {
  const u = await getUser(ctx); if (!u) return unauthorized();
  const b = (await ctx.request.json().catch(() => null)) || {};
  if (!RATINGS.includes(b.rating)) return json({ error: 'Avaliação inválida' }, 400);
  const card = await ctx.env.DB.prepare(
    'SELECT id, ease, interval_days, repetitions, due_at FROM cards WHERE id = ? AND user_id = ?')
    .bind(Number(b.card_id), u.id).first();
  if (!card) return json({ error: 'Cartão não encontrado' }, 404);
  if (card.due_at > now()) return json({ error: 'Este cartão ainda não está na fila de hoje' }, 409);
  const n = sm2(card, b.rating);  // o cliente nunca envia intervalo nem data
  const t = now();
  await ctx.env.DB.prepare(
    `UPDATE cards SET ease = ?, interval_days = ?, repetitions = ?, due_at = ?, last_reviewed = ?
     WHERE id = ? AND user_id = ?`)
    .bind(n.ease, n.interval_days, n.repetitions, t + n.interval_days * DAY, t, card.id, u.id).run();
  return json({ interval_days: n.interval_days });
}