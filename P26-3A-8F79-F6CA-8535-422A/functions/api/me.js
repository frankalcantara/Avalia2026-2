import { HttpError, json, requireUser, toUser } from "../_lib.js";

// GET /api/me → { user }
export async function onRequestGet({ request, env }) {
  const uid = await requireUser(request, env);
  const row = await env.DB.prepare("SELECT user_id, username, avatar FROM users WHERE user_id = ?").bind(uid).first();
  if (!row) throw new HttpError(401, "Sessão inválida ou expirada.");
  return json({ user: toUser(row) });
}

export { methodNotAllowed as onRequest } from "../_lib.js";
