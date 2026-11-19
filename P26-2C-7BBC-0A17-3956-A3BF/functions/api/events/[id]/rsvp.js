import { getSession, unauthorized } from "../../../_lib/session.js";

export async function onRequestPost({ request, env, params }) {
  const session = await getSession(request, env);
  if (!session) return unauthorized();
  const eventId = Number(params.id);

  const event = await env.DB.prepare("SELECT id FROM events WHERE id = ?1").bind(eventId).first();
  if (!event) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

  await env.DB.prepare(
    "INSERT OR IGNORE INTO discord_users (user_id, username, avatar) VALUES (?1, ?2, ?3)"
  ).bind(session.userId, session.username, session.avatar).run();

  // Uma única instrução: decide "confirmed" ou "waitlist" de forma atômica.
  await env.DB.prepare(`
    INSERT INTO rsvps (event_id, user_id, status)
    SELECT ?1, ?2,
      CASE WHEN (SELECT COUNT(*) FROM rsvps WHERE event_id = ?1 AND status = 'confirmed')
                < (SELECT capacity FROM events WHERE id = ?1)
           THEN 'confirmed' ELSE 'waitlist' END
    WHERE true
    ON CONFLICT(event_id, user_id) DO NOTHING
  `).bind(eventId, session.userId).run();

  const mine = await env.DB.prepare(
    "SELECT status FROM rsvps WHERE event_id = ?1 AND user_id = ?2"
  ).bind(eventId, session.userId).first();

  return Response.json({ ok: true, status: mine.status });
}

export async function onRequestDelete({ request, env, params }) {
  const session = await getSession(request, env);
  if (!session) return unauthorized();
  const eventId = Number(params.id);

  const mine = await env.DB.prepare(
    "SELECT id FROM rsvps WHERE event_id = ?1 AND user_id = ?2"
  ).bind(eventId, session.userId).first();
  if (!mine) return Response.json({ ok: false, error: "not_registered" }, { status: 404 });

  // Remove a inscrição e promove o primeiro da fila se sobrou vaga.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rsvps WHERE event_id = ?1 AND user_id = ?2")
      .bind(eventId, session.userId),
    env.DB.prepare(`
      UPDATE rsvps SET status = 'confirmed'
      WHERE id = (SELECT id FROM rsvps WHERE event_id = ?1 AND status = 'waitlist'
                  ORDER BY created_at, id LIMIT 1)
        AND (SELECT COUNT(*) FROM rsvps WHERE event_id = ?1 AND status = 'confirmed')
            < (SELECT capacity FROM events WHERE id = ?1)
    `).bind(eventId),
  ]);

  return Response.json({ ok: true });
}