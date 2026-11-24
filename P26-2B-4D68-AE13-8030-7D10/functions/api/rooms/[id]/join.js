import { errorResponse, isSameOrigin, json, requireDatabase } from "../../../_lib/http.js";
import { normalizeRoomCode, resolveJoin } from "../../../_lib/rooms.js";
import { getSession } from "../../../_lib/session.js";
import { isPositiveId } from "../../../_lib/validation.js";

// Entrar em sala: pública usa o id numérico; privada usa o código hash da sala.
// Quem o dono marcou como "somente aprovação" fica na fila de pedidos.
export async function onRequestPost({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para entrar em uma sala.", 401);

  // Código primeiro: 18+ caracteres hex nunca são id de sala. Ids são curtos.
  const code = normalizeRoomCode(params.id);
  const numeric = !code && isPositiveId(params.id);
  if (!numeric && !code) return errorResponse("Sala não encontrada.", 404);

  const room = numeric
    ? await env.DB.prepare("SELECT id, visibility, join_policy FROM rooms WHERE id = ?")
      .bind(params.id).first()
    : await env.DB.prepare("SELECT id, visibility, join_policy FROM rooms WHERE visibility = 'private' AND invite_hash = ?")
      .bind(code).first();

  if (!room) return errorResponse("Sala não encontrada. Confira o código.", 404);
  if (numeric && room.visibility === "private") {
    return errorResponse("Sala privada: entre com o código dela.", 400);
  }

  const member = await env.DB.prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .bind(room.id, user.userId).first();

  const blocked = await env.DB.prepare("SELECT 1 FROM room_blocks WHERE room_id = ? AND user_id = ?")
    .bind(room.id, user.userId).first();
  if (blocked && !member) return errorResponse("O dono removeu seu acesso a esta sala.", 403);

  const action = resolveJoin({
    isMember: Boolean(member),
    visibility: room.visibility,
    joinPolicy: room.join_policy,
  });

  if (action !== "pending") {
    if (action === "joined") {
      await env.DB.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
        .bind(room.id, user.userId).run();
    }
    return json({ ok: true, joined: true });
  }

  await env.DB.prepare("INSERT INTO room_join_requests (room_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(room.id, user.userId).run();
  return json({ ok: true, pending: true });
}
