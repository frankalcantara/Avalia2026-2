import { requireUser, json, serializeQuote } from '../../_lib/auth.js';
import { validateQuote, likePattern } from '../../_lib/validate.js';

const SELECT = `SELECT q.*, u.username, u.avatar FROM quotes q JOIN users u ON u.id = q.user_id`;

// GET /api/quotes?scope=mine|public&q=busca
export async function onRequestGet(ctx) {
  const { user, response } = await requireUser(ctx);
  if (response) return response;

  const url = new URL(ctx.request.url);
  const scope = url.searchParams.get('scope') === 'public' ? 'public' : 'mine';
  const q = (url.searchParams.get('q') || '').trim();

  const where = [scope === 'public' ? 'q.is_public = 1' : 'q.user_id = ?1'];
  const binds = scope === 'public' ? [] : [user.id];
  if (q) {
    const n = binds.length + 1;
    where.push(`(q.author LIKE ?${n} ESCAPE '\\' OR q.theme LIKE ?${n} ESCAPE '\\' OR q.text LIKE ?${n} ESCAPE '\\' OR q.work LIKE ?${n} ESCAPE '\\')`);
    binds.push(likePattern(q));
  }
  const { results } = await ctx.env.DB
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY q.created_at DESC, q.id DESC LIMIT 100`)
    .bind(...binds).all();

  return json({ quotes: results.map((r) => serializeQuote(r, user.id)) });
}

// POST /api/quotes
export async function onRequestPost(ctx) {
  const { user, response } = await requireUser(ctx, { write: true });
  if (response) return response;

  const body = await ctx.request.json().catch(() => null);
  const v = validateQuote(body);
  if (!v.ok) return json({ error: 'Dados inválidos.', details: v.errors }, 400);

  const { text, author, work, page, theme, notes, is_public } = v.value;
  const res = await ctx.env.DB.prepare(
    `INSERT INTO quotes (user_id, text, author, work, page, theme, notes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, text, author, work, page, theme || null, notes || null, is_public).run();

  const row = await ctx.env.DB.prepare(`${SELECT} WHERE q.id = ?`).bind(res.meta.last_row_id).first();
  return json({ quote: serializeQuote(row, user.id) }, 201);
}
