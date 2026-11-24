/**
 * Cloudflare Pages Function: GET /api/me
 * Returns the logged-in Discord user (user_id, username, avatar) or 401.
 */
import { getUser, json } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getUser(env, request);
  if (!user) return json({ error: "Não autenticado." }, 401);
  return json({ user });
}
