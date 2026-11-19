import { requireUser, json, serializeQuote } from '../../_lib/auth.js';
import { validateQuote } from '../../_lib/validate.js';

const parseId = (p) => { const n = Number(p.id); return Number.isInteger(n) && n > 0 ? n : null; };

// Regra de negócio: só o criador altera ou apaga. Checado no servidor, não no cliente.
async function checkOwner(ctx, id, user) {
  const row = await ctx.env.DB.prepare('SELECT user_id FROM quotes WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Citação não encontrada.' }, 404);
  if (row.user_id !== user.id) return json({ error: 'Você não pode alterar esta citação.' }, 403);
  return null;
}

export async function onRequestPut(ctx) {
  const { user, response } = await requireUser(ctx, { write: true });
  if (response) return response;
  const id = parseId(ctx.params);
  if (!id) return json({ error: 'ID inválido.' }, 400);

  const denied = await checkOwner(ctx, id, user);
  if (denied) return denied;

  const v = validateQuote(await ctx.request.json().catch(() => null));
  if (!v.ok) return json({ error: 'Dados inválidos.', details: v.errors }, 400);

  const { text, author, work, page, theme, notes, is_public } = v.value;
  await ctx.env.DB.prepare(
    `UPDATE quotes SET text=?, author=?, work=?, page=?, theme=?, notes=?, is_public=?, updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).bind(text, author, work, page, theme || null, notes || null, is_public, id, user.id).run();

  const row = await ctx.env.DB.prepare(
    'SELECT q.*, u.username, u.avatar FROM quotes q JOIN users u ON u.id = q.user_id WHERE q.id = ?'
  ).bind(id).first();
  return json({ quote: serializeQuote(row, user.id) });
}

export async function onRequestDelete(ctx) {
  const { user, response } = await requireUser(ctx, { write: true });
  if (response) return response;
  const id = parseId(ctx.params);
  if (!id) return json({ error: 'ID inválido.' }, 400);

  const denied = await checkOwner(ctx, id, user);
  if (denied) return denied;

  await ctx.env.DB.prepare('DELETE FROM quotes WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  return json({ ok: true });
}
