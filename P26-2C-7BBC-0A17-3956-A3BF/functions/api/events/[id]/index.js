import { getSession } from "../../../_lib/session.js";

export async function onRequestGet({ request, env, params }) {
  const session = await getSession(request, env);
  const eventId = Number(params.id);
  const event = await env.DB.prepare("SELECT * FROM events WHERE id = ?1").bind(eventId).first();
  if (!event) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

  const { results } = await env.DB.prepare(`
    SELECT r.user_id, r.status, r.created_at, u.username, u.avatar
    FROM rsvps r JOIN discord_users u ON u.user_id = r.user_id
    WHERE r.event_id = ?1
    ORDER BY r.created_at, r.id
  `).bind(eventId).all();

  const confirmed = results.filter((r) => r.status === "confirmed");
  const waitlist = results.filter((r) => r.status === "waitlist");
  const mine = session ? results.find((r) => r.user_id === session.userId) : null;

  return Response.json({
    ok: true,
    event,
    confirmed,
    waitlist,
    my_status: mine ? mine.status : null,
    my_waitlist_position: mine && mine.status === "waitlist"
      ? waitlist.findIndex((r) => r.user_id === session.userId) + 1
      : null,
  });
}
