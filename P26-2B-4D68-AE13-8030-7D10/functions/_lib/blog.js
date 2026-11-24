const SESSION_COOKIE = "discord_session";

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export function errorResponse(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function requireDatabase(env) {
  if (!env.DB) return errorResponse("Banco de dados indisponível.", 503);
  return null;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeText(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(user, secret) {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const payload = encodeText(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 86400 }));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function getSession(request, secret) {
  if (!secret || secret.length < 32) return null;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  try {
    const [payload, signature] = match[1].split(".");
    if (!payload || !signature) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!session.userId || !session.username || !session.exp || session.exp <= Date.now() / 1000) return null;
    return { userId: String(session.userId), username: String(session.username), avatar: session.avatar || null };
  } catch {
    return null;
  }
}

export function cookie(name, value, request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookie(name, request) {
  return cookie(name, "", request, 0);
}

export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

export async function readJson(request) {
  try {
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return null;
    return await request.json();
  } catch {
    return null;
  }
}

export function validId(value) {
  return /^\d+$/.test(String(value || "")) && Number(value) > 0;
}

export async function isRoomMember(db, roomId, userId) {
  if (!userId) return false;
  const member = await db.prepare(
    "SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?",
  ).bind(roomId, userId).first();
  return Boolean(member);
}

export async function canViewRoom(db, roomId, userId) {
  const room = await db.prepare("SELECT visibility FROM rooms WHERE id = ?").bind(roomId).first();
  if (!room) return false;
  return room.visibility === "public" || await isRoomMember(db, roomId, userId);
}

export function requestIsSafe(request) {
  return isSameOrigin(request);
}
