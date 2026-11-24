import { requireUser } from '../../lib/auth.js';
import { buildDashboard, getToday } from '../../lib/dashboard.js';
import { fail, json } from '../../lib/http.js';
import { isValidMonth } from '../../lib/stats.js';

// GET /api/dashboard?month=YYYY-MM — hábitos, conclusões do mês e métricas consolidadas.
export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  const url = new URL(context.request.url);
  const month = url.searchParams.get('month') ?? getToday(context.env).slice(0, 7);
  if (!isValidMonth(month)) return fail(400, 'Mês inválido. Use o formato YYYY-MM.', 'invalid_month');

  return json(await buildDashboard(context.env, auth.user, month));
}
