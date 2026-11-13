const encoder = new TextEncoder();
const SESSION_COOKIE_NAME = "discord_session";

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function createMac(value, env) {
  const secret = env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

export async function signValue(value, env) {
  const payload = toBase64Url(encoder.encode(value));
  const signature = toBase64Url(await createMac(value, env));
  return `${payload}.${signature}`;
}

export async function verifyValue(token, env) {
  if (!token || !token.includes(".")) return null;

  try {
    const [encodedPayload, encodedSignature] = token.split(".");
    const value = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const expectedSignature = await createMac(value, env);
    const suppliedSignature = fromBase64Url(encodedSignature);

    if (
      suppliedSignature.length !== expectedSignature.length
      || !suppliedSignature.every(
        (byte, index) => byte === expectedSignature[index],
      )
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
  );

  return match?.[1] || "";
}

export async function getSession(request, env) {
  const encodedSession = readCookie(request, SESSION_COOKIE_NAME);
  const sessionJson = await verifyValue(encodedSession, env);
  if (!sessionJson) return null;

  try {
    const session = JSON.parse(sessionJson);
    const isExpired = !session.expiresAt || session.expiresAt < Date.now();
    if (!session.userId || !session.username || isExpired) return null;

    return {
      userId: String(session.userId),
      username: String(session.username),
      avatar: String(session.avatar || ""),
    };
  } catch {
    return null;
  }
}

export function sessionCookie(value, maxAge = 86400) {
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

export function jsonError(error, status) {
  return Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireSession(context) {
  const user = await getSession(context.request, context.env);
  return user
    ? { user }
    : { response: jsonError("authentication_required", 401) };
}
