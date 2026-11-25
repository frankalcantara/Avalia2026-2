const SESSION_COOKIE = "discord_session";
const STATE_COOKIE = "discord_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24;
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function cookieValue(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }
    return cookie.slice(separator + 1).trim();
  }
  return null;
}

function cookieAttributes(request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSignedSession(user, secret) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)),
  );
  return `${payload}.${base64UrlEncode(signature)}`;
}

export async function readSession(request, secret) {
  const value = cookieValue(request, SESSION_COOKIE);
  if (!value || !secret) {
    return null;
  }

  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra !== undefined) {
      return null;
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder.encode(payload),
    );
    if (!isValid) {
      return null;
    }

    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (
      typeof session.userId !== "string" ||
      typeof session.username !== "string" ||
      typeof session.exp !== "number" ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      userId: session.userId,
      username: session.username,
      avatar: typeof session.avatar === "string" ? session.avatar : null,
    };
  } catch {
    return null;
  }
}

export function createOAuthState() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export function getOAuthState(request) {
  return cookieValue(request, STATE_COOKIE);
}

export function clearOAuthStateCookie(request) {
  return `${STATE_COOKIE}=; ${cookieAttributes(request, 0)}`;
}

export function setOAuthStateCookie(request, state) {
  return `${STATE_COOKIE}=${state}; ${cookieAttributes(request, 600)}`;
}

export function setSessionCookie(request, session) {
  return `${SESSION_COOKIE}=${session}; ${cookieAttributes(request, SESSION_TTL_SECONDS)}`;
}

export function clearSessionCookie(request) {
  return `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`;
}

export { SESSION_TTL_SECONDS };
