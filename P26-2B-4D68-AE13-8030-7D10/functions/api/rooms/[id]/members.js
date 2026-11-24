import { errorResponse, isSameOrigin, json } from "../../../_lib/http.js";
import { requireRoomOwner } from "../../../_lib/rooms.js";

export async function onRequestGet({ request, env, params }) {
  const { response, room } = await requireRoomOwner(request, env, params);
  if (response) return response;

  const result = await env.DB.prepare(`
    SELECT m.user_id, m.joined_at, u.username, u.avatar
    FROM room_members m JOIN discord_users u ON u.user_id = m.user_id
    WHERE m.room_id = ?
    ORDER BY m.joined_at ASC, u.username COLLATE NOCASE
    LIMIT 200
  `).bind(params.id).all();

  const blocked = await env.DB.prepare(`
    SELECT b.user_id, b.created_at, u.username, u.avatar
    FROM room_blocks b JOIN discord_users u ON u.user_id = b.user_id
    WHERE b.room_id = ?
    ORDER BY b.created_at ASC
    LIMIT 200
  `).bind(params.id).all();

  return json({ members: result.results || [], blocked: blocked.results || [], ownerId: room.owner_id });
}

export async function onRequestDelete({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);

  const { response, room } = await requireRoomOwner(request, env, params);
  if (response) return response;

  const userId = new URL(request.url).searchParams.get("userId") || "";
  if (!userId) return errorResponse("Informe quem remover.");
  if (userId === room.owner_id) return errorResponse("O dono da sala não pode ser removido.", 400);

  const result = await env.DB.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?")
    .bind(params.id, userId).run();
  if (!result.meta.changes) return errorResponse("Essa pessoa não é membro da sala.", 404);

  await env.DB.prepare("DELETE FROM room_join_requests WHERE room_id = ? AND user_id = ?")
    .bind(params.id, userId).run();
  // Remover também bloqueia: a pessoa só volta se o dono liberar de novo (ou reaprovar um pedido).
  await env.DB.prepare("INSERT INTO room_blocks (room_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(params.id, userId).run();
  return json({ ok: true, blocked: true });
}
