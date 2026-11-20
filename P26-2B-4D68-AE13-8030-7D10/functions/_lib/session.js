export const SESSION_COOKIE = "discord_session";
export const OAUTH_STATE_COOKIE = "discord_oauth_state";
export const OAUTH_STATE_MAX_AGE = 600;

const SESSION_MAX_AGE = 86400;
const MIN_SECRET_LENGTH = 32;

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeText(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function hasUsableSecret(secret) {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
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

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : "";
}

export async function signSession(user, secret) {
  if (!hasUsableSecret(secret)) throw new Error(`SESSION_SECRET must contain at least ${MIN_SECRET_LENGTH} characters.`);
  const payload = encodeText(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function getSession(request, secret) {
  if (!hasUsableSecret(secret)) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  try {
    const [payload, signature] = token.split(".");
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

export function serializeCookie(name, value, request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(value, request) {
  return serializeCookie(SESSION_COOKIE, value, request, SESSION_MAX_AGE);
}

export function clearedCookie(name, request) {
  return serializeCookie(name, "", request, 0);
}
