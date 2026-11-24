/**
 * /api/habits/:id
 *   PATCH  { name?, color? } → renomeia / troca a cor
 *   DELETE                   → remove o hábito e todas as marcações (ON DELETE CASCADE)
 */
import { json, error, readJson } from "../../../src/lib/http.js";
import { validateHabitId, validateHabitName, validateColor } from "../../../src/lib/validate.js";
import { getOwnedHabit, nameTaken, isUniqueViolation } from "../../../src/lib/habits.js";

export async function onRequestPatch({ request, env, data, params }) {
  if (!data.user) return error(401, "Faça login com o Discord.");
  const id = validateHabitId(params.id);
  if (!id.ok) return error(400, id.error);

  const habit = await getOwnedHabit(env.DB, data.user.user_id, id.value);
  if (!habit) return error(404, "Hábito não encontrado.");

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;
  if (body.name === undefined && body.color === undefined) return error(422, "Nada para atualizar.");

  let name = habit.name;
  if (body.name !== undefined) {
    const v = validateHabitName(body.name);
    if (!v.ok) return error(422, v.error);
    name = v.value;
    if (await nameTaken(env.DB, data.user.user_id, name, habit.id)) {
      return error(409, "Você já tem um hábito com esse nome.", "duplicate_name");
    }
  }

  let color = habit.color;
  if (body.color !== undefined) {
    const v = validateColor(body.color);
    if (!v.ok) return error(422, v.error);
    color = v.value;
  }

  try {
    await env.DB.prepare("UPDATE habits SET name = ?, color = ? WHERE id = ? AND user_id = ?")
      .bind(name, color, habit.id, data.user.user_id)
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) return error(409, "Você já tem um hábito com esse nome.", "duplicate_name");
    throw err;
  }
  return json({ ok: true, habit: { id: habit.id, name, color, createdAt: habit.created_at } });
}

export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return error(401, "Faça login com o Discord.");
  const id = validateHabitId(params.id);
  if (!id.ok) return error(400, id.error);

  const habit = await getOwnedHabit(env.DB, data.user.user_id, id.value);
  if (!habit) return error(404, "Hábito não encontrado.");

  // apaga explicitamente as marcações e depois o hábito (não depende só do PRAGMA foreign_keys)
  await env.DB.batch([
    env.DB.prepare("DELETE FROM completions WHERE habit_id = ?").bind(habit.id),
    env.DB.prepare("DELETE FROM habits WHERE id = ? AND user_id = ?").bind(habit.id, data.user.user_id),
  ]);
  return json({ ok: true, deleted: habit.id });
}
