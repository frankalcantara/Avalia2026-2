import { authenticate, databaseFailure, json, requireDatabase } from "../../_shared.js";

export async function onRequestGet(context) {
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  try {
    const cycle = await context.env.DB.prepare(
      `SELECT cycles.id, cycles.subject_id, subjects.name AS subject_name,
              cycles.duration_seconds, cycles.status, cycles.started_at
       FROM pomodoro_cycles AS cycles
       JOIN subjects ON subjects.id = cycles.subject_id AND subjects.user_id = cycles.user_id
       WHERE cycles.user_id = ? AND cycles.status = 'running'`
    ).bind(auth.user.user_id).first();
    return json({ ok: true, cycle: cycle || null });
  } catch {
    return databaseFailure();
  }
}