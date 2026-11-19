import { getSession } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env);
  return Response.json({
    ok: true,
    user: s ? { userId: s.userId, username: s.username, avatar: s.avatar } : null,
  });
}