import { getSession, unauthorized } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env);
  const { results } = await env.DB.prepare(`
    SELECT e.id, e.title, e.location, e.event_date, e.event_time, e.capacity, e.owner_id,
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed_count,
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'waitlist') AS waitlist_count,
      (SELECT status FROM rsvps r WHERE r.event_id = e.id AND r.user_id = ?1) AS my_status
    FROM events e
    ORDER BY e.event_date, e.event_time
  `).bind(session ? session.userId : "").all();
  return Response.json({ ok: true, events: results });
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const title = String(body.title || "").trim();
  const location = String(body.location || "").trim();
  const date = String(body.event_date || "").trim();
  const time = String(body.event_time || "").trim();
  const capacity = Number(body.capacity);

  const errors = [];
  if (!title || title.length > 120) errors.push("title");
  if (!location || location.length > 120) errors.push("location");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("event_date");
  if (!/^\d{2}:\d{2}$/.test(time)) errors.push("event_time");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) errors.push("capacity");
  if (errors.length) {
    return Response.json({ ok: false, error: "validation", fields: errors }, { status: 400 });
  }

  await env.DB.prepare(
    "INSERT OR IGNORE INTO discord_users (user_id, username, avatar) VALUES (?1, ?2, ?3)"
  ).bind(session.userId, session.username, session.avatar).run();

  const res = await env.DB.prepare(
    "INSERT INTO events (owner_id, title, location, event_date, event_time, capacity) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
  ).bind(session.userId, title, location, date, time, capacity).run();

  return Response.json({ ok: true, id: res.meta.last_row_id }, { status: 201 });
}