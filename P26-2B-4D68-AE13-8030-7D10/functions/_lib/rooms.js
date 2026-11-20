import { errorResponse, requireDatabase } from "./http.js";
import { randomHex } from "./random.js";
import { getSession } from "./session.js";
import { isPositiveId } from "./validation.js";

export const JOIN_POLICIES = ["open_link", "approval"];

// Sala privada se entra só com o ID dela: nada de código de convite.
// Decide o que fazer com o pedido de entrada, sem tocar no banco.
export function resolveJoin({ isMember, visibility, joinPolicy }) {
  if (isMember) return "already_member";
  if (visibility === "private" && joinPolicy === "approval") return "pending";
  return "joined";
}

// Código de entrada da sala privada: hash SHA-256 do ID da sala com um nonce
// aleatório. 24 caracteres hex (96 bits) não são adivinháveis nem sequenciais,
// e são o que o dono compartilha no lugar do ID numérico.
export const ROOM_CODE_LENGTH = 24;
// Aceita também códigos antigos (nonce de 36 hex) já gravados no banco.
export const ROOM_CODE_PATTERN = /^[a-f0-9]{18,64}$/;

export async function generateRoomCode(roomId) {
  const seed = `sala-privada:${roomId}:${randomHex(16)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, ROOM_CODE_LENGTH);
}

export function normalizeRoomCode(value) {
  const code = String(value ?? "").trim().toLowerCase();
  return ROOM_CODE_PATTERN.test(code) ? code : "";
}

// Usado pelos endpoints de gestão da sala: devolve { response } em caso de erro ou { user, room }.
export async function requireRoomOwner(request, env, params) {
  const unavailable = requireDatabase(env);
  if (unavailable) return { response: unavailable };

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return { response: errorResponse("Entre com Discord para gerenciar a sala.", 401) };
  if (!isPositiveId(params.id)) return { response: errorResponse("Sala não encontrada.", 404) };

  const room = await env.DB.prepare("SELECT owner_id, visibility FROM rooms WHERE id = ?")
    .bind(params.id).first();
  if (!room) return { response: errorResponse("Sala não encontrada.", 404) };
  if (room.owner_id !== user.userId) {
    return { response: errorResponse("Apenas o dono da sala pode gerenciar isso.", 403) };
  }
  return { user, room };
}

async function isRoomMember(db, roomId, userId) {
  if (!userId) return false;
  const member = await db.prepare(
    "SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?",
  ).bind(roomId, userId).first();
  return Boolean(member);
}

export async function canViewRoom(db, roomId, userId) {
  const room = await db.prepare("SELECT visibility FROM rooms WHERE id = ?").bind(roomId).first();
  if (!room) return false;
  return room.visibility === "public" || isRoomMember(db, roomId, userId);
}
