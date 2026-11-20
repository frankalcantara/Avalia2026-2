import { errorResponse, isSameOrigin, json, readJson, requireDatabase } from "../../../_lib/http.js";
import { requireRoomOwner } from "../../../_lib/rooms.js";

export async function onRequestGet({ request, env, params }) {
  const { response } = await requireRoomOwner(request, env, params);
  if (response) return response;

  const result = await env.DB.prepare(`
    SELECT req.user_id, req.created_at, u.username, u.avatar
    FROM room_join_requests req JOIN discord_users u ON u.user_id = req.user_id
    WHERE req.room_id = ?
    ORDER BY req.created_at ASC, req.user_id ASC
    LIMIT 200
  `).bind(params.id).all();
  return json({ requests: result.results || [] });
}

export async function onRequestPost({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);

  const { response } = await requireRoomOwner(request, env, params);
  if (response) return response;

  const body = await readJson(request);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const action = body?.action;
  if (!userId || !["approve", "reject"].includes(action)) return errorResponse("Decisão inválida.");

  const pending = await env.DB.prepare(
    "SELECT 1 FROM room_join_requests WHERE room_id = ? AND user_id = ?",
  ).bind(params.id, userId).first();
  if (!pending) return errorResponse("Pedido não encontrado.", 404);

  if (action === "approve") {
    await env.DB.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
      .bind(params.id, userId).run();
    // Aprovar um pedido explícito do dono libera um bloqueio anterior.
    await env.DB.prepare("DELETE FROM room_blocks WHERE room_id = ? AND user_id = ?")
      .bind(params.id, userId).run();
  }
  await env.DB.prepare("DELETE FROM room_join_requests WHERE room_id = ? AND user_id = ?")
    .bind(params.id, userId).run();
  return json({ ok: true, action });
}
