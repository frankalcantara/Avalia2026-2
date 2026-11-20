import { authenticate, databaseFailure, failure, json, requireDatabase, requireSameOrigin, validId } from "../../../../_shared.js";

export async function onRequestPost(context) {
  if (!requireSameOrigin(context.request)) return failure("csrf_rejected", 403, "Origem da requisição inválida.");
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const id = validId(context.params.id);
  if (!id) return failure("invalid_cycle_id", 400, "ID de ciclo inválido.");
  const now = new Date().toISOString();
  let result;
  try {
    result = await context.env.DB.prepare(
      `UPDATE pomodoro_cycles SET status = 'cancelled', cancelled_at = ?
       WHERE id = ? AND user_id = ? AND status = 'running'`
    ).bind(now, id, auth.user.user_id).run();
  } catch {
    return databaseFailure();
  }
  if (!result.meta.changes) {
    let owned;
    try {
      owned = await context.env.DB.prepare(
        "SELECT status FROM pomodoro_cycles WHERE id = ? AND user_id = ?"
      ).bind(id, auth.user.user_id).first();
    } catch {
      return databaseFailure();
    }
    return owned
      ? failure("cycle_not_running", 409, "O ciclo não está em execução.")
      : failure("cycle_not_found", 404, "Ciclo não encontrado.");
  }

  let cycle;
  try {
    cycle = await context.env.DB.prepare(
      `SELECT id, subject_id, duration_seconds, status, started_at, cancelled_at
       FROM pomodoro_cycles WHERE id = ? AND user_id = ?`
    ).bind(id, auth.user.user_id).first();
  } catch {
    return databaseFailure();
  }
  return json({ ok: true, cycle });
}