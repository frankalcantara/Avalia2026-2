import { requireUser } from '../../../../lib/auth.js';
import { buildDashboard, getToday } from '../../../../lib/dashboard.js';
import { fail, json, parseHabitId, readJsonBody } from '../../../../lib/http.js';
import { isValidISODate } from '../../../../lib/stats.js';

// PUT /api/habits/:id/completions  { date: "YYYY-MM-DD", done: boolean }
// Marca/desmarca o dia e devolve o painel do mês recalculado (streaks e taxa vêm do servidor).
export async function onRequestPut(context) {
  const auth = await requireUser(context, { mutation: true });
  if (auth.response) return auth.response;

  const id = parseHabitId(context.params.id);
  if (id === null) return fail(400, 'ID de hábito inválido.', 'invalid_id');

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;
  const { date, done } = parsed.body;

  if (!isValidISODate(date)) return fail(400, 'Data inválida. Use YYYY-MM-DD.', 'invalid_date');
  if (typeof done !== 'boolean') return fail(400, 'O campo "done" deve ser true ou false.', 'invalid_done');
  if (date > getToday(context.env)) {
    return fail(400, 'Não é possível marcar dias futuros.', 'future_date');
  }

  const { env } = context;
  const owned = await env.DB.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?')
    .bind(id, auth.user.id)
    .first();
  if (!owned) return fail(404, 'Hábito não encontrado.', 'not_found');

  if (done) {
    await env.DB.prepare('INSERT OR IGNORE INTO completions (habit_id, date) VALUES (?, ?)').bind(id, date).run();
  } else {
    await env.DB.prepare('DELETE FROM completions WHERE habit_id = ? AND date = ?').bind(id, date).run();
  }

  return json(await buildDashboard(env, auth.user, date.slice(0, 7)));
}
