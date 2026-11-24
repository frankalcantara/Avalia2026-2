import { errorResponse, isSameOrigin, json, readJson } from "../../_lib/http.js";
import { JOIN_POLICIES, requireRoomOwner } from "../../_lib/rooms.js";
import { isDiscordUserId } from "../../_lib/validation.js";

export async function onRequestPatch({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);

  const { response, user, room } = await requireRoomOwner(request, env, params);
  if (response) return response;

  const body = (await readJson(request)) || {};

  // Transferência de dono: o novo dono precisa já participar da sala.
  if (body.ownerId !== undefined) {
    const ownerId = String(body.ownerId ?? "");
    if (!isDiscordUserId(ownerId)) return errorResponse("Pessoa inválida para transferir a sala.");
    if (ownerId === user.userId) return errorResponse("Você já é o dono desta sala.");
    const member = await env.DB.prepare(
      "SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?",
    ).bind(params.id, ownerId).first();
    if (!member) return errorResponse("A pessoa precisa participar da sala antes de virar dona.", 400);

    await env.DB.prepare("UPDATE rooms SET owner_id = ? WHERE id = ?").bind(ownerId, params.id).run();
    return json({ ok: true, ownerId });
  }

  if (room.visibility !== "private") return errorResponse("Salas públicas já são abertas a todos.", 400);

  const joinPolicy = body.joinPolicy;
  if (!JOIN_POLICIES.includes(joinPolicy)) return errorResponse("Política de entrada inválida.");

  await env.DB.prepare("UPDATE rooms SET join_policy = ? WHERE id = ?").bind(joinPolicy, params.id).run();
  return json({ ok: true, joinPolicy });
}

export async function onRequestDelete({ request, env, params }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);

  const { response } = await requireRoomOwner(request, env, params);
  if (response) return response;

  // Os artigos não somem com a sala: voltam para a página pública do blog.
  await env.DB.prepare("UPDATE articles SET room_id = NULL WHERE room_id = ?").bind(params.id).run();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM room_join_requests WHERE room_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM room_blocks WHERE room_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM room_members WHERE room_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM rooms WHERE id = ?").bind(params.id),
  ]);
  return json({ ok: true, articlesMovedToPublic: true });
}
