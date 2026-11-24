import { json, fail, requireUser, readJson, validateTransaction } from '../../_lib.js';

const parseId = (params) => (/^\d{1,15}$/.test(params.id) ? Number(params.id) : null);

export async function onRequestPut({ request, env, params }) {
  const auth = await requireUser(request, env, true);
  if (auth.response) return auth.response;
  const id = parseId(params);
  if (!id) return fail(404, 'Transação não encontrada.');

  const checked = validateTransaction(await readJson(request));
  if (checked.error) return fail(400, checked.error);
  const t = checked.value;

  const result = await env.DB.prepare(
    'UPDATE transactions SET type = ?, amount_cents = ?, category = ?, description = ?, date = ? WHERE id = ? AND user_id = ?'
  ).bind(t.type, t.amount_cents, t.category, t.description, t.date, id, auth.user.id).run();
  if (!result.meta.changes) return fail(404, 'Transação não encontrada.');
  return json({ id });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireUser(request, env, true);
  if (auth.response) return auth.response;
  const id = parseId(params);
  if (!id) return fail(404, 'Transação não encontrada.');

  const result = await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').bind(id, auth.user.id).run();
  if (!result.meta.changes) return fail(404, 'Transação não encontrada.');
  return json({ ok: true });
}
