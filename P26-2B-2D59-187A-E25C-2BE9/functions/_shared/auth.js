const SESSION_COOKIE = "__Host-almoxarifado_session";
const STATE_COOKIE = "__Host-almoxarifado_oauth_state";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const STATE_MAX_AGE = 10 * 60;
const PASSWORD_HASH_ITERATIONS = 310_000;
const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function methodNotAllowed(allow) {
  return json({ error: "Método não permitido." }, 405, { Allow: allow });
}

export function getSessionSecret(env) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return env.SESSION_SECRET;
}

export function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_HASH_ITERATIONS },
    key,
    256,
  ));
  return {
    salt: toBase64Url(salt),
    hash: toBase64Url(hash),
  };
}

export async function verifyPassword(password, saltValue, hashValue) {
  const salt = fromBase64Url(saltValue);
  const expectedHash = fromBase64Url(hashValue);
  if (!salt || salt.length !== 16 || !expectedHash || expectedHash.length !== 32) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const actualHash = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_HASH_ITERATIONS },
    key,
    256,
  ));
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= expectedHash[index] ^ actualHash[index];
  }
  return difference === 0;
}

async function signature(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = encoder.encode(payload);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

async function signJson(value, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(value)));
  return `${payload}.${toBase64Url(await signature(payload, secret))}`;
}

async function verifyJson(token, secret) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const suppliedSignature = fromBase64Url(parts[1]);
  const payloadBytes = fromBase64Url(parts[0]);
  if (!suppliedSignature || !payloadBytes) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (!(await crypto.subtle.verify("HMAC", key, suppliedSignature, encoder.encode(parts[0])))) {
    return null;
  }

  try {
    return JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearAuthCookies(headers) {
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
  headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
}

export async function makeStateCookie(state, secret) {
  const value = await signJson(
    { state, exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE },
    secret,
  );
  return cookie(STATE_COOKIE, value, STATE_MAX_AGE);
}

export async function verifyOAuthState(request, suppliedState, secret) {
  const signedState = await verifyJson(getCookie(request, STATE_COOKIE), secret);
  if (
    !signedState ||
    typeof signedState.state !== "string" ||
    typeof signedState.exp !== "number" ||
    signedState.exp <= Math.floor(Date.now() / 1000) ||
    typeof suppliedState !== "string" ||
    signedState.state.length !== suppliedState.length
  ) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < suppliedState.length; index += 1) {
    difference |= signedState.state.charCodeAt(index) ^ suppliedState.charCodeAt(index);
  }
  return difference === 0;
}

export async function makeSessionCookie(user, secret) {
  const value = await signJson(
    {
      user_id: user.user_id,
      username: user.username,
      avatar: user.avatar,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    },
    secret,
  );
  return cookie(SESSION_COOKIE, value, SESSION_MAX_AGE);
}

export async function getSession(request, env) {
  const secret = getSessionSecret(env);
  const session = await verifyJson(getCookie(request, SESSION_COOKIE), secret);
  if (
    !session ||
    typeof session.user_id !== "string" ||
    typeof session.username !== "string" ||
    !(session.avatar === null || typeof session.avatar === "string") ||
    typeof session.exp !== "number" ||
    session.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return {
    user_id: session.user_id,
    username: session.username,
    avatar: session.avatar,
  };
}

export function configuredOAuth(env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new Error("Missing required Discord OAuth configuration.");
  }
  return {
    clientId: String(env.DISCORD_CLIENT_ID),
    clientSecret: String(env.DISCORD_CLIENT_SECRET),
  };
}

export function callbackUrl(request) {
  return new URL("/api/auth/discord/callback", new URL(request.url).origin).toString();
}

export function createOAuthState() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function avatarUrl(userId, avatarHash) {
  if (typeof avatarHash !== "string" || !/^[A-Za-z0-9_]+$/.test(avatarHash)) return null;
  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}`;
}
