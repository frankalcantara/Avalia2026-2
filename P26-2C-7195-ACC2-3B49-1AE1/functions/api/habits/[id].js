import { requireUser } from '../../../lib/auth.js';
import { fail, json, parseHabitId } from '../../../lib/http.js';

// DELETE /api/habits/:id — remove o hábito e suas conclusões (somente do dono).
export async function onRequestDelete(context) {
  const auth = await requireUser(context, { mutation: true });
  if (auth.response) return auth.response;

  const id = parseHabitId(context.params.id);
  if (id === null) return fail(400, 'ID de hábito inválido.', 'invalid_id');

  const { env } = context;
  const owned = await env.DB.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?')
    .bind(id, auth.user.id)
    .first();
  if (!owned) return fail(404, 'Hábito não encontrado.', 'not_found');

  await env.DB.batch([
    env.DB.prepare('DELETE FROM completions WHERE habit_id = ?').bind(id),
    env.DB.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').bind(id, auth.user.id),
  ]);
  return json({ ok: true });
}
