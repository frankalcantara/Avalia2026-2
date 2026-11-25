import { json } from "../../_shared/http.js";
import { readSession } from "../../_shared/session.js";

export async function onRequestGet({ request, env }) {
  const user = await readSession(request, env.SESSION_SECRET);
  return json({ authenticated: Boolean(user), user });
}
