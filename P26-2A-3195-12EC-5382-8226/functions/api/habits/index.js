/**
 * /api/habits
 *   GET  ?month=AAAA-MM&today=AAAA-MM-DD → painel do mês (hábitos, marcações e métricas)
 *   POST { name, color }                 → cadastra uma nova meta recorrente
 */
import { json, error, readJson } from "../../../src/lib/http.js";
import { resolveToday } from "../../../src/lib/dates.js";
import { validateHabitName, validateColor, validateMonth, MAX_HABITS_PER_USER } from "../../../src/lib/validate.js";
import { buildDashboard, nameTaken, isUniqueViolation } from "../../../src/lib/habits.js";

export async function onRequestGet({ request, env, data }) {
  if (!data.user) return error(401, "Faça login com o Discord.");
  const url = new URL(request.url);
  const today = resolveToday(url.searchParams.get("today"));
  const month = validateMonth(url.searchParams.get("month"), today);
  if (!month.ok) return error(400, month.error);

  const dashboard = await buildDashboard(env.DB, data.user.user_id, month.value, today);
  return json({ ok: true, ...dashboard });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return error(401, "Faça login com o Discord.");
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  const name = validateHabitName(parsed.body.name);
  if (!name.ok) return error(422, name.error);
  const color = validateColor(parsed.body.color);
  if (!color.ok) return error(422, color.error);

  const userId = data.user.user_id;
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM habits WHERE user_id = ?").bind(userId).first();
  if (Number(count?.n || 0) >= MAX_HABITS_PER_USER) {
    return error(409, `Limite de ${MAX_HABITS_PER_USER} hábitos atingido.`, "habit_limit");
  }

  if (await nameTaken(env.DB, userId, name.value)) {
    return error(409, "Você já tem um hábito com esse nome.", "duplicate_name");
  }

  // INSERT condicional: a checagem do limite e a gravação acontecem num único comando,
  // então requisições paralelas não conseguem ultrapassar o limite.
  let habit;
  try {
    habit = await env.DB.prepare(
      `INSERT INTO habits (user_id, name, color)
       SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM habits WHERE user_id = ?) < ?
       RETURNING id, name, color, created_at`
    )
      .bind(userId, name.value, color.value, userId, MAX_HABITS_PER_USER)
      .first();
  } catch (err) {
    if (isUniqueViolation(err)) return error(409, "Você já tem um hábito com esse nome.", "duplicate_name");
    throw err;
  }
  if (!habit) return error(409, `Limite de ${MAX_HABITS_PER_USER} hábitos atingido.`, "habit_limit");

  return json({ ok: true, habit: { id: habit.id, name: habit.name, color: habit.color, createdAt: habit.created_at } }, 201);
}
