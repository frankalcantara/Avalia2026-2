const SESSION_COOKIE = "__Host-lab_session";
const STATE_COOKIE = "__Host-discord_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const STATE_TTL_SECONDS = 10 * 60;

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret) {
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("SESSION_SECRET deve conter pelo menos 32 bytes.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value, secret) {
  const key = await signingKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function readCookie(request, name) {
  for (const cookie of (request.headers.get("Cookie") || "").split(";")) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) return valueParts.join("=");
  }
  return null;
}

export async function createSessionCookie(user, secret) {
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({ user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    ),
  );
  const value = `${payload}.${await sign(payload, secret)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export async function getSessionUser(request, secret) {
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const key = await signingKey(secret);
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (
      typeof session.user?.id !== "string" ||
      typeof session.user?.username !== "string" ||
      !Number.isSafeInteger(session.exp) ||
      session.exp <= Date.now() / 1000
    ) {
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

export async function createStateCookie(state, secret) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const value = `${state}.${issuedAt}`;
  return `${STATE_COOKIE}=${value}.${await sign(value, secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`;
}

export async function consumeStateCookie(request, expectedState, secret) {
  const state = readCookie(request, STATE_COOKIE);
  if (!state || !expectedState) return false;
  const [storedState, issuedAtValue, signature, extra] = state.split(".");
  if (
    extra ||
    storedState !== expectedState ||
    !/^\d+$/.test(issuedAtValue || "") ||
    !/^[A-Za-z0-9_-]+$/.test(signature || "")
  ) {
    return false;
  }
  const issuedAt = Number(issuedAtValue);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > STATE_TTL_SECONDS) {
    return false;
  }
  const key = await signingKey(secret);
  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${storedState}.${issuedAtValue}`),
    );
  } catch {
    return false;
  }
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
