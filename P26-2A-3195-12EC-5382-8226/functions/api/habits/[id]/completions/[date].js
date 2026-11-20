/**
 * /api/habits/:id/completions/:date   (date = AAAA-MM-DD)
 *   PUT    → marca o dia como cumprido (idempotente)
 *   DELETE → desmarca o dia (idempotente)
 * Query opcional: ?month=AAAA-MM&today=AAAA-MM-DD para devolver as métricas do mês exibido.
 * Resposta: hábito atualizado + resumo do painel, já recalculados no servidor.
 */
import { json, error } from "../../../../../src/lib/http.js";
import { resolveToday } from "../../../../../src/lib/dates.js";
import { validateHabitId, validateCompletionDate, validateMonth } from "../../../../../src/lib/validate.js";
import { getOwnedHabit, buildDashboard } from "../../../../../src/lib/habits.js";

async function handle({ request, env, data, params }, done) {
  if (!data.user) return error(401, "Faça login com o Discord.");
  const userId = data.user.user_id;
  const url = new URL(request.url);
  const today = resolveToday(url.searchParams.get("today"));

  const id = validateHabitId(params.id);
  if (!id.ok) return error(400, id.error);
  const date = validateCompletionDate(params.date, today);
  if (!date.ok) return error(422, date.error);
  const month = validateMonth(url.searchParams.get("month"), today);
  if (!month.ok) return error(400, month.error);

  const habit = await getOwnedHabit(env.DB, userId, id.value);
  if (!habit) return error(404, "Hábito não encontrado.");

  if (done) {
    await env.DB.prepare("INSERT OR IGNORE INTO completions (habit_id, date) VALUES (?, ?)")
      .bind(habit.id, date.value)
      .run();
  } else {
    await env.DB.prepare("DELETE FROM completions WHERE habit_id = ? AND date = ?")
      .bind(habit.id, date.value)
      .run();
  }

  const dashboard = await buildDashboard(env.DB, userId, month.value, today);
  return json({
    ok: true,
    date: date.value,
    done,
    habit: dashboard.habits.find((h) => h.id === habit.id),
    summary: dashboard.summary,
  });
}

export const onRequestPut = (ctx) => handle(ctx, true);
export const onRequestDelete = (ctx) => handle(ctx, false);
