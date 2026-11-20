const SESSION_COOKIE = "discord_session";
const OAUTH_STATE_COOKIE = "discord_oauth_state";
const SESSION_MAX_AGE_SECONDS = 86400;
const OAUTH_STATE_MAX_AGE_SECONDS = 600;
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url value.");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function secureCookie(request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const cookie = part.trim();
    const separator = cookie.indexOf("=");
    if (separator > 0 && cookie.slice(0, separator) === name) {
      return cookie.slice(separator + 1);
    }
  }
  return null;
}

export function assertSessionSecret(secret) {
  if (typeof secret !== "string" || encoder.encode(secret).byteLength < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }
}

async function importSigningKey(secret) {
  assertSessionSecret(secret);
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function createOAuthState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export function oauthStateCookie(state, request) {
  return `${OAUTH_STATE_COOKIE}=${state}; Path=/api/auth/discord; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_STATE_MAX_AGE_SECONDS}${secureCookie(request)}`;
}

export function clearOAuthStateCookie(request) {
  return `${OAUTH_STATE_COOKIE}=; Path=/api/auth/discord; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(request)}`;
}

export async function createSessionCookie(user, secret, request) {
  const key = await importSigningKey(secret);
  const payload = {
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  const token = `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureCookie(request)}`;
}

export function clearSessionCookie(request) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(request)}`;
}

export async function readSession(request, secret) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const key = await importSigningKey(secret);
  let payloadBytes;
  let signature;
  try {
    payloadBytes = fromBase64Url(parts[0]);
    signature = fromBase64Url(parts[1]);
  } catch {
    return null;
  }

  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(parts[0]),
  );
  if (!validSignature) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  if (
    !payload
    || typeof payload.userId !== "string"
    || typeof payload.username !== "string"
    || !(typeof payload.avatar === "string" || payload.avatar === null)
    || !Number.isSafeInteger(payload.expiresAt)
    || payload.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return {
    userId: payload.userId,
    username: payload.username,
    avatar: payload.avatar,
  };
}
