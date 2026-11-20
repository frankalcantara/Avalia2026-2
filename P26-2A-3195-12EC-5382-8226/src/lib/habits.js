/**
 * Acesso a dados de hábitos no D1 + montagem das métricas.
 * Toda consulta filtra por user_id: um usuário nunca enxerga dados de outro.
 */
import { habitMetrics, summarize } from "./metrics.js";
import { monthBounds } from "./dates.js";

export async function getOwnedHabit(db, userId, habitId) {
  return db
    .prepare("SELECT id, name, color, created_at FROM habits WHERE id = ? AND user_id = ?")
    .bind(habitId, userId)
    .first();
}

/**
 * Nome já usado por outro hábito do mesmo usuário? Compara sem diferenciar
 * maiúsculas/minúsculas inclusive em letras acentuadas ("ÁGUA" = "água"),
 * o que o COLLATE NOCASE do SQLite não faz sozinho.
 */
export async function nameTaken(db, userId, name, exceptId = null) {
  const { results } = await db.prepare("SELECT id, name FROM habits WHERE user_id = ?").bind(userId).all();
  const key = name.toLocaleLowerCase("pt-BR");
  return (results || []).some((h) => h.id !== exceptId && String(h.name).toLocaleLowerCase("pt-BR") === key);
}

/** Erro de índice único do SQLite/D1 (ex.: dois cadastros iguais enviados ao mesmo tempo). */
export function isUniqueViolation(err) {
  return /UNIQUE constraint failed/i.test(String(err && (err.message || err)));
}

/** Todas as datas concluídas por hábito do usuário (até hoje), agrupadas por habit_id. */
async function completionsByHabit(db, userId, today, habitId = null) {
  let sql = `SELECT c.habit_id, c.date FROM completions c
               JOIN habits h ON h.id = c.habit_id
              WHERE h.user_id = ? AND c.date <= ?`;
  const params = [userId, today];
  if (habitId !== null) {
    sql += " AND c.habit_id = ?";
    params.push(habitId);
  }
  sql += " ORDER BY c.date";
  const { results } = await db.prepare(sql).bind(...params).all();
  const map = new Map();
  for (const row of results || []) {
    if (!map.has(row.habit_id)) map.set(row.habit_id, []);
    map.get(row.habit_id).push(row.date);
  }
  return map;
}

function shapeHabit(habit, dates, month, today) {
  const { first, last } = monthBounds(month);
  return {
    id: habit.id,
    name: habit.name,
    color: habit.color,
    createdAt: habit.created_at,
    days: dates.filter((d) => d >= first && d <= last), // datas marcadas no mês exibido
    metrics: habitMetrics(dates, month, today, habit.created_at),
  };
}

/** Painel completo: hábitos do usuário, marcações do mês e métricas consolidadas. */
export async function buildDashboard(db, userId, month, today) {
  const { results: habits } = await db
    .prepare("SELECT id, name, color, created_at FROM habits WHERE user_id = ? ORDER BY id")
    .bind(userId)
    .all();
  const byHabit = await completionsByHabit(db, userId, today);
  const shaped = (habits || []).map((h) => shapeHabit(h, byHabit.get(h.id) || [], month, today));
  return {
    month,
    today,
    habits: shaped,
    summary: summarize(shaped.map((h) => h.metrics)),
  };
}
