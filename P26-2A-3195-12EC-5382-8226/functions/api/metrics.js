/**
 * GET /api/metrics?month=AAAA-MM&today=AAAA-MM-DD
 * Somente as métricas consolidadas (streak máximo, sequência atual e taxa mensal),
 * por hábito e no total, calculadas no servidor.
 */
import { json, error } from "../../src/lib/http.js";
import { resolveToday } from "../../src/lib/dates.js";
import { validateMonth } from "../../src/lib/validate.js";
import { buildDashboard } from "../../src/lib/habits.js";

export async function onRequestGet({ request, env, data }) {
  if (!data.user) return error(401, "Faça login com o Discord.");
  const url = new URL(request.url);
  const today = resolveToday(url.searchParams.get("today"));
  const month = validateMonth(url.searchParams.get("month"), today);
  if (!month.ok) return error(400, month.error);

  const d = await buildDashboard(env.DB, data.user.user_id, month.value, today);
  return json({
    ok: true,
    month: d.month,
    today: d.today,
    summary: d.summary,
    habits: d.habits.map((h) => ({ id: h.id, name: h.name, ...h.metrics })),
  });
}
