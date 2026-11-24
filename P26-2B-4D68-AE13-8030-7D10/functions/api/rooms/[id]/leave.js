import { errorResponse, isSameOrigin, json, requireDatabase } from "../../../_lib/http.js";
import { getSession } from "../../../_lib/session.js";
import { isPositiveId } from "../../../_lib/validation.js";

export async function onRequestPost({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para sair da sala.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Sala não encontrada.", 404);

  const room = await env.DB.prepare("SELECT owner_id FROM rooms WHERE id = ?").bind(params.id).first();
  if (!room) return errorResponse("Sala não encontrada.", 404);
  if (room.owner_id === user.userId) {
    return errorResponse("Você é o dono: transfira a sala ou exclua para sair.", 400);
  }

  const result = await env.DB.prepare(
    "DELETE FROM room_members WHERE room_id = ? AND user_id = ?",
  ).bind(params.id, user.userId).run();
  if (!result.meta.changes) return errorResponse("Você não participa desta sala.", 404);

  return json({ ok: true, left: true });
}
