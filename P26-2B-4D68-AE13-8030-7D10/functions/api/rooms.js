import { errorResponse, isSameOrigin, json, readJson, requireDatabase } from "../_lib/http.js";
import { generateRoomCode } from "../_lib/rooms.js";
import { randomHex } from "../_lib/random.js";
import { getSession } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  const viewer = user?.userId || "";
  const result = await env.DB.prepare(`
    SELECT r.id, r.name, r.description, r.visibility, r.owner_id, r.join_policy, r.created_at,
      EXISTS (SELECT 1 FROM room_members mine WHERE mine.room_id = r.id AND mine.user_id = ?) AS is_member,
      (SELECT COUNT(*) FROM room_members members WHERE members.room_id = r.id) AS member_count,
      (SELECT COUNT(*) FROM room_join_requests pending WHERE pending.room_id = r.id AND r.owner_id = ?) AS pending_count,
      CASE WHEN r.owner_id = ? THEN r.invite_hash END AS room_code
    FROM rooms r
    WHERE r.visibility = 'public'
      OR r.owner_id = ?
      OR EXISTS (SELECT 1 FROM room_members mine WHERE mine.room_id = r.id AND mine.user_id = ?)
    ORDER BY CASE WHEN r.visibility = 'public' THEN 0 ELSE 1 END, r.name COLLATE NOCASE
    LIMIT 100
  `).bind(viewer, viewer, viewer, viewer, viewer).all();
  return json({ rooms: result.results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para criar uma sala.", 401);

  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const visibility = body?.visibility;
  if (name.length < 3 || name.length > 60) return errorResponse("O nome deve ter entre 3 e 60 caracteres.");
  if (description.length > 240) return errorResponse("A descrição aceita até 240 caracteres.");
  if (!["public", "private"].includes(visibility)) return errorResponse("Escolha uma sala pública ou privada.");

  // O código da sala privada só pode ser calculado depois do INSERT (usa o id).
  // O valor provisório só existe entre o INSERT e o UPDATE abaixo.
  const provisional = visibility === "private" ? randomHex(16) : null;

  const result = await env.DB.prepare(
    "INSERT INTO rooms (owner_id, name, description, visibility, invite_hash) VALUES (?, ?, ?, ?, ?)",
  ).bind(user.userId, name, description, visibility, provisional).run();
  const roomId = result.meta.last_row_id;

  let code = null;
  if (visibility === "private") {
    code = await generateRoomCode(roomId);
    await env.DB.prepare("UPDATE rooms SET invite_hash = ? WHERE id = ?").bind(code, roomId).run();
  }

  await env.DB.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?, ?)")
    .bind(roomId, user.userId).run();
  return json({ ok: true, id: roomId, code }, 201);
}
