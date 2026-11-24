import { errorResponse, json, requireDatabase } from "../../_lib/http.js";
import { isDiscordUserId } from "../../_lib/validation.js";

export async function onRequestGet({ env, params }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const id = String(params.id || "");
  if (!isDiscordUserId(id)) return errorResponse("Autor não encontrado.", 404);

  const author = await env.DB.prepare(
    "SELECT user_id, username, avatar FROM discord_users WHERE user_id = ?",
  ).bind(id).first();
  if (!author) return errorResponse("Autor não encontrado.", 404);
  return json({ author });
}
