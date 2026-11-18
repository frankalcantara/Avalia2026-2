const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;

    if (cookie.slice(0, separatorIndex).trim() === name) {
      return cookie.slice(separatorIndex + 1).trim();
    }
  }

  return null;
}

export function buildCookie(request, name, value, maxAge) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (new URL(request.url).protocol === "https:") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  if (value.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function constantTimeEqual(left, right) {
  const comparisonLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < comparisonLength; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }

  return difference === 0;
}

export async function createSessionValue(userId, env) {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  if (!/^\d+$/.test(userId)) {
    throw new Error("A valid Discord user ID is required.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = await sign(payload, env.SESSION_SECRET);
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function getSessionUser(request, env) {
  const sessionValue = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionValue) return null;
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  if (!env.DB) {
    throw new Error("D1 database is not configured.");
  }

  const parts = sessionValue.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[1])) return null;

  const [userId, expiresAtValue, signatureValue] = parts;
  if (!userId || !/^\d+$/.test(userId)) return null;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const suppliedSignature = base64UrlToBytes(signatureValue);
  if (!suppliedSignature) return null;

  const expectedSignature = await sign(`${userId}.${expiresAtValue}`, env.SESSION_SECRET);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  return env.DB.prepare(
    "SELECT user_id, username, global_name, avatar FROM discord_users WHERE user_id = ?",
  )
    .bind(userId)
    .first();
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
