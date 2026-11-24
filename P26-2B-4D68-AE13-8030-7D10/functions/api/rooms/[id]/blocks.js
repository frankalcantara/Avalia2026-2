import { errorResponse, isSameOrigin, json } from "../../../_lib/http.js";
import { requireRoomOwner } from "../../../_lib/rooms.js";

export async function onRequestDelete({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);

  const { response } = await requireRoomOwner(request, env, params);
  if (response) return response;

  const userId = new URL(request.url).searchParams.get("userId") || "";
  if (!userId) return errorResponse("Informe quem liberar.");

  const result = await env.DB.prepare("DELETE FROM room_blocks WHERE room_id = ? AND user_id = ?")
    .bind(params.id, userId).run();
  if (!result.meta.changes) return errorResponse("Essa pessoa não está bloqueada.", 404);
  return json({ ok: true });
}
