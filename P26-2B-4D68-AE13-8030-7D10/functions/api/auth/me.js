import { json } from "../../_lib/http.js";
import { getSession } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  return json({ user: await getSession(request, env.SESSION_SECRET) });
}
