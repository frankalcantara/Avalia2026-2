import { getUser } from "./_lib/auth.js";
import { json } from "./_lib/http.js";
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  return json({ user: user || null });
}
