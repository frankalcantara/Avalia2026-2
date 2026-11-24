import { getSession, requireDB } from "../../_lib/auth.js";
import { errorResponse, json, methodNotAllowed } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(request, env);
    const db = requireDB(env);
    const user = await db.prepare(
      "SELECT user_id, username, avatar FROM discord_users WHERE user_id = ?",
    ).bind(session.user_id).first();
    if (!user) return json({ error: "unauthenticated", message: "Usuário não encontrado." }, 401);
    return json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET"]);
}
