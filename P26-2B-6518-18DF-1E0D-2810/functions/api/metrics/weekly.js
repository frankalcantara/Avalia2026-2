import { authenticate, databaseFailure, json, requireDatabase } from "../../_shared.js";
import { weeklyRange } from "../../_weekly.js";

export async function onRequestGet(context) {
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;

  const week = weeklyRange();
  let totals;
  let groups;
  try {
    totals = await context.env.DB.prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds, COUNT(*) AS completed_cycles
       FROM pomodoro_cycles
       WHERE user_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?`
    ).bind(auth.user.user_id, week.start, week.end).first();
    groups = await context.env.DB.prepare(
      `SELECT cycles.subject_id, subjects.name, SUM(cycles.duration_seconds) AS total_seconds, COUNT(*) AS completed_cycles
       FROM pomodoro_cycles AS cycles
       JOIN subjects ON subjects.id = cycles.subject_id AND subjects.user_id = cycles.user_id
       WHERE cycles.user_id = ? AND cycles.status = 'completed' AND cycles.completed_at >= ? AND cycles.completed_at < ?
       GROUP BY cycles.subject_id, subjects.name
       ORDER BY total_seconds DESC, subjects.name COLLATE NOCASE`
    ).bind(auth.user.user_id, week.start, week.end).all();
  } catch {
    return databaseFailure();
  }

  const totalSeconds = Number(totals?.total_seconds || 0);
  return json({
    ok: true,
    week: { starts_on: week.startsOn, ends_on: week.endsOn, time_zone: "America/Sao_Paulo" },
    total_seconds: totalSeconds,
    total_hours: Math.round((totalSeconds / 3600) * 100) / 100,
    completed_cycles: Number(totals?.completed_cycles || 0),
    subjects: (groups.results || []).map((row) => {
      const seconds = Number(row.total_seconds);
      return {
        subject_id: row.subject_id,
        name: row.name,
        total_seconds: seconds,
        total_hours: Math.round((seconds / 3600) * 100) / 100,
        completed_cycles: Number(row.completed_cycles),
      };
    }),
  });
}