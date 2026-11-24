import { readSession } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const s = await readSession(request, env.SESSION_SECRET);
  const user = s ? { userId: s.userId, username: s.username, avatar: s.avatar } : null;
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
