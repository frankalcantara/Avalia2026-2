import { requireUser, json, serializeQuote } from '../../_lib/auth.js';

const BASE = `SELECT q.*, u.username, u.avatar FROM quotes q JOIN users u ON u.id = q.user_id WHERE q.is_public = 1`;

// GET /api/quotes/random[?exclude=ID] -> uma citação PÚBLICA sorteada
export async function onRequestGet(ctx) {
  const { user, response } = await requireUser(ctx);
  if (response) return response;

  const exclude = Number.parseInt(new URL(ctx.request.url).searchParams.get('exclude'), 10);
  let row = await ctx.env.DB
    .prepare(`${BASE} AND q.id != ? ORDER BY RANDOM() LIMIT 1`)
    .bind(Number.isInteger(exclude) ? exclude : -1).first();
  // Se só existe uma citação pública e ela é a excluída, devolve ela mesma.
  if (!row) row = await ctx.env.DB.prepare(`${BASE} ORDER BY RANDOM() LIMIT 1`).first();

  return json({ quote: row ? serializeQuote(row, user.id) : null });
}
