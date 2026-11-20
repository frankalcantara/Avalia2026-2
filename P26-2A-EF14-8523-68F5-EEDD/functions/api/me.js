import { getSessionUser } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  return Response.json({ ok: true, user });
}
