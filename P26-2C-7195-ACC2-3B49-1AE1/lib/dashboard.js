import { publicUser } from './auth.js';
import { computeHabitStats, computeOverall, daysInMonth, todayInTimeZone } from './stats.js';

export const DEFAULT_TZ = 'America/Sao_Paulo';

export function getToday(env) {
  return todayInTimeZone(env.APP_TZ || DEFAULT_TZ);
}

/** Monta o painel do mês: hábitos, dias concluídos e métricas calculadas no servidor. */
export async function buildDashboard(env, user, month) {
  const today = getToday(env);

  const { results: habitRows } = await env.DB.prepare(
    'SELECT id, name, color FROM habits WHERE user_id = ? ORDER BY id',
  )
    .bind(user.id)
    .all();

  const { results: completionRows } = await env.DB.prepare(
    `SELECT c.habit_id AS habit_id, c.date AS date
       FROM completions c JOIN habits h ON h.id = c.habit_id
      WHERE h.user_id = ? ORDER BY c.date`,
  )
    .bind(user.id)
    .all();

  const byHabit = new Map();
  for (const row of completionRows) {
    if (!byHabit.has(row.habit_id)) byHabit.set(row.habit_id, []);
    byHabit.get(row.habit_id).push(row.date);
  }

  const habits = habitRows.map((h) => {
    const dates = byHabit.get(h.id) ?? [];
    return {
      id: h.id,
      name: h.name,
      color: h.color,
      completedDates: dates.filter((d) => d.startsWith(`${month}-`) && d <= today),
      stats: computeHabitStats(dates, month, today),
    };
  });

  return {
    month,
    today,
    daysInMonth: daysInMonth(month),
    user: publicUser(user),
    habits,
    overall: computeOverall(habits.map((h) => h.stats)),
  };
}
