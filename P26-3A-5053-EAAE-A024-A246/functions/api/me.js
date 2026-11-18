import { getSessionUser, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ ok: false, error: "Authentication required." }, 401);

  return json({ ok: true, data: user });
}
