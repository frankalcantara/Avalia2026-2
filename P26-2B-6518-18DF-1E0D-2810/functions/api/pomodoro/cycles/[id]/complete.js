import { authenticate, databaseFailure, failure, json, requireDatabase, requireSameOrigin, validId } from "../../../../_shared.js";

const CYCLE_SELECT = "id, subject_id, duration_seconds, status, started_at, completed_at";

export async function onRequestPost(context) {
  if (!requireSameOrigin(context.request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const id = validId(context.params.id);
  if (!id) return failure("invalid_cycle_id", 400, "ID de ciclo inválido.");
  let cycle;
  try {
    cycle = await context.env.DB.prepare(
      `SELECT ${CYCLE_SELECT} FROM pomodoro_cycles WHERE id = ? AND user_id = ?`
    ).bind(id, auth.user.user_id).first();
  } catch {
    return databaseFailure();
  }
  if (!cycle) return failure("cycle_not_found", 404, "Ciclo não encontrado.");
  if (cycle.status === "completed") return json({ ok: true, cycle, replayed: true });
  if (cycle.status === "cancelled") return failure("cycle_not_running", 409, "O ciclo não está em execução.");

  const now = new Date();
  if (Date.parse(cycle.started_at) + cycle.duration_seconds * 1000 > now.getTime()) {
    return failure("cycle_too_early", 409, "O tempo configurado ainda não terminou.");
  }

  let result;
  let completed;
  try {
    result = await context.env.DB.prepare(
      `UPDATE pomodoro_cycles SET status = 'completed', completed_at = ?
       WHERE id = ? AND user_id = ? AND status = 'running'`
    ).bind(now.toISOString(), id, auth.user.user_id).run();
  } catch {
    return databaseFailure();
  }
  if (!result.meta.changes) {
    try {
      cycle = await context.env.DB.prepare(
        `SELECT ${CYCLE_SELECT} FROM pomodoro_cycles WHERE id = ? AND user_id = ?`
      ).bind(id, auth.user.user_id).first();
    } catch {
      return databaseFailure();
    }
    if (!cycle) return failure("cycle_not_found", 404, "Ciclo não encontrado.");
    if (cycle.status === "completed") return json({ ok: true, cycle, replayed: true });
    return failure("cycle_not_running", 409, "O ciclo não está em execução.");
  }

  try {
    completed = await context.env.DB.prepare(
      `SELECT ${CYCLE_SELECT} FROM pomodoro_cycles WHERE id = ? AND user_id = ?`
    ).bind(id, auth.user.user_id).first();
  } catch {
    return databaseFailure();
  }
  return json({ ok: true, cycle: completed, replayed: false });
}
