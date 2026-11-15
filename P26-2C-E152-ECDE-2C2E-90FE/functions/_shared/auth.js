const STATE_COOKIE = "soundroom_oauth_state";
const SESSION_COOKIE = "soundroom_session";
const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/v10/users/@me";
const DEFAULT_STATE_TTL_SECONDS = 600;
const DEFAULT_SESSION_TTL_SECONDS = 604800;
const MAX_DISCORD_RESPONSE_BYTES = 16384;

export class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function methodNotAllowed(allowedMethod) {
  return jsonResponse(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `Use ${allowedMethod} para esta rota.`,
      },
    },
    405,
    { Allow: allowedMethod },
  );
}

export function handleAuthError(error) {
  if (error instanceof AuthConfigurationError) {
    return jsonResponse(
      { error: { code: "AUTH_NOT_CONFIGURED", message: error.message } },
      503,
    );
  }

  console.error("Authentication request failed:", error?.name ?? "UnknownError");
  return jsonResponse(
    { error: { code: "AUTH_SERVICE_ERROR", message: "Não foi possível concluir a autenticação." } },
    500,
  );
}

export function getOAuthConfig(env) {
  const clientId = env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim();
  const redirectUriValue = env.DISCORD_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUriValue) {
    throw new AuthConfigurationError(
      "Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI e APP_URL.",
    );
  }

  let redirectUri;
  try {
    // Validate APP_URL here as well; it is the only post-login redirect base.
    getAppUrl(env);
    redirectUri = new URL(redirectUriValue);
  } catch {
    throw new AuthConfigurationError("APP_URL ou DISCORD_REDIRECT_URI inválida.");
  }
  const appUrl = getAppUrl(env);

  if (
    !isAllowedApplicationUrl(appUrl)
    || appUrl.pathname !== "/"
    || appUrl.search
    || appUrl.hash
    || appUrl.username
    || appUrl.password
  ) {
    throw new AuthConfigurationError("APP_URL deve ser uma origem HTTPS ou localhost sem caminho adicional.");
  }

  if (
    !isAllowedApplicationUrl(redirectUri)
    || redirectUri.origin !== appUrl.origin
    || redirectUri.pathname !== "/api/auth/callback"
    || redirectUri.search
    || redirectUri.hash
    || redirectUri.username
    || redirectUri.password
  ) {
    throw new AuthConfigurationError(
      "DISCORD_REDIRECT_URI deve ser /api/auth/callback na mesma origem de APP_URL.",
    );
  }

  return {
    appUrl,
    clientId,
    clientSecret,
    redirectUri: redirectUri.href,
    secureCookie: appUrl.protocol === "https:",
    stateTtlSeconds: readTtl(
      env.OAUTH_STATE_TTL_SECONDS,
      DEFAULT_STATE_TTL_SECONDS,
      60,
      900,
      "OAUTH_STATE_TTL_SECONDS",
    ),
    sessionTtlSeconds: readTtl(
      env.SESSION_TTL_SECONDS,
      DEFAULT_SESSION_TTL_SECONDS,
      300,
      2592000,
      "SESSION_TTL_SECONDS",
    ),
  };
}

export function getAppUrl(env) {
  const appUrlValue = env.APP_URL?.trim();
  if (!appUrlValue) {
    throw new AuthConfigurationError("Configure APP_URL.");
  }

  let appUrl;
  try {
    appUrl = new URL(appUrlValue);
  } catch {
    throw new AuthConfigurationError("APP_URL inválida.");
  }

  if (
    !isAllowedApplicationUrl(appUrl)
    || appUrl.pathname !== "/"
    || appUrl.search
    || appUrl.hash
    || appUrl.username
    || appUrl.password
  ) {
    throw new AuthConfigurationError("APP_URL deve ser uma origem HTTPS ou localhost sem caminho adicional.");
  }

  return appUrl;
}

function isAllowedApplicationUrl(url) {
  if (url.protocol === "https:") {
    return true;
  }

  return url.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function readTtl(value, defaultValue, minimum, maximum, name) {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AuthConfigurationError(`${name} deve ser um inteiro entre ${minimum} e ${maximum}.`);
  }

  return parsed;
}

export function createRandomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    return part.slice(separator + 1).trim() || null;
  }

  return null;
}

function cookie(name, value, { path, maxAge, secure }) {
  return [
    `${name}=${value}`,
    "HttpOnly",
    `Path=${path}`,
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

function clearCookie(name, path, secure) {
  return [
    `${name}=`,
    "HttpOnly",
    `Path=${path}`,
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    secure ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(timestamp, seconds) {
  return new Date(Date.parse(timestamp) + seconds * 1000).toISOString();
}

function assertDatabase(env) {
  if (!env.DB) {
    throw new AuthConfigurationError("O binding D1 DB não está configurado.");
  }
}

function errorRedirect(appUrl, reason, clearState = false, secure = appUrl.protocol === "https:") {
  const destination = new URL("/", appUrl);
  destination.searchParams.set("auth_error", reason);
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: destination.href,
  });

  if (clearState) {
    headers.append("Set-Cookie", clearCookie(STATE_COOKIE, "/api/auth", secure));
  }

  return new Response(null, { status: 303, headers });
}

function isValidDiscordProfile(profile) {
  return profile
    && typeof profile === "object"
    && typeof profile.id === "string"
    && /^\d{17,20}$/u.test(profile.id)
    && typeof profile.username === "string"
    && profile.username.length > 0
    && profile.username.length <= 32
    && (
      profile.global_name === null
      || profile.global_name === undefined
      || (
        typeof profile.global_name === "string"
        && profile.global_name.length <= 128
      )
    )
    && (
      profile.avatar === null
      || profile.avatar === undefined
      || (
        typeof profile.avatar === "string"
        && /^[A-Za-z0-9_]{1,128}$/u.test(profile.avatar)
      )
    );
}

async function parseDiscordJson(response) {
  const contentLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_DISCORD_RESPONSE_BYTES) {
    return null;
  }

  const text = await response.text();
  if (text.length > MAX_DISCORD_RESPONSE_BYTES) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function exchangeAuthorizationCode(fetchImpl, config, code) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  let response;
  try {
    response = await fetchImpl(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { error: "provider_unavailable" };
  }

  const tokenData = await parseDiscordJson(response);
  if (!response.ok) {
    return { error: "code_rejected" };
  }
  if (
    !tokenData
    || typeof tokenData.access_token !== "string"
    || tokenData.access_token.length < 1
    || tokenData.access_token.length > 8192
    || typeof tokenData.token_type !== "string"
    || tokenData.token_type.toLowerCase() !== "bearer"
    || typeof tokenData.scope !== "string"
    || !tokenData.scope.split(/\s+/u).includes("identify")
  ) {
    return { error: "invalid_token_response" };
  }

  return { accessToken: tokenData.access_token };
}

async function fetchDiscordProfile(fetchImpl, accessToken) {
  let response;
  try {
    response = await fetchImpl(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { error: "provider_unavailable" };
  }

  const profile = await parseDiscordJson(response);
  if (!response.ok) {
    return { error: "profile_unavailable" };
  }
  if (!isValidDiscordProfile(profile)) {
    return { error: "invalid_profile" };
  }

  return { profile };
}

async function upsertUser(db, profile) {
  const timestamp = nowIso();
  const displayName = profile.global_name?.trim() || profile.username;
  const avatarHash = profile.avatar ?? null;
  const user = await db.prepare(`
    INSERT INTO users (id, discord_id, display_name, avatar_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (discord_id) DO UPDATE SET
      display_name = excluded.display_name,
      avatar_hash = excluded.avatar_hash,
      updated_at = excluded.updated_at
    RETURNING id, discord_id, display_name, avatar_hash
  `).bind(crypto.randomUUID(), profile.id, displayName, avatarHash, timestamp, timestamp).first();

  if (!user?.id || user.discord_id !== profile.id) {
    throw new Error("User upsert returned an invalid row.");
  }
  return user;
}

function publicUser(user) {
  const avatarUrl = user.avatar_hash
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar_hash}.${user.avatar_hash.startsWith("a_") ? "gif" : "png"}`
    : null;

  return {
    id: user.id,
    discordId: user.discord_id,
    displayName: user.display_name,
    avatarUrl,
  };
}

export async function handleDiscordLogin({ request, env }) {
  if (request.method !== "GET") {
    return methodNotAllowed("GET");
  }

  const config = getOAuthConfig(env);
  assertDatabase(env);
  const state = createRandomToken();
  const timestamp = nowIso();
  const stateHash = await sha256Hex(state);
  const expiresAt = addSeconds(timestamp, config.stateTtlSeconds);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(timestamp),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(timestamp),
    env.DB.prepare("INSERT INTO oauth_states (state_hash, expires_at) VALUES (?, ?)")
      .bind(stateHash, expiresAt),
  ]);

  const authorizationUrl = new URL(DISCORD_AUTHORIZE_URL);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: authorizationUrl.href,
      "Set-Cookie": cookie(STATE_COOKIE, state, {
        path: "/api/auth",
        maxAge: config.stateTtlSeconds,
        secure: config.secureCookie,
      }),
    },
  });
}

export async function handleDiscordCallback({ request, env }, fetchImpl = fetch) {
  if (request.method !== "GET") {
    return methodNotAllowed("GET");
  }

  const config = getOAuthConfig(env);
  assertDatabase(env);
  const callbackUrl = new URL(request.url);
  const returnedStates = callbackUrl.searchParams.getAll("state");
  const codes = callbackUrl.searchParams.getAll("code");
  const stateCookie = readCookie(request, STATE_COOKIE);

  if (
    returnedStates.length !== 1
    || codes.length > 1
    || !stateCookie
    || !/^[A-Za-z0-9_-]{43}$/u.test(stateCookie)
    || returnedStates[0] !== stateCookie
  ) {
    return errorRedirect(config.appUrl, "state", true, config.secureCookie);
  }

  const timestamp = nowIso();
  const stateHash = await sha256Hex(stateCookie);
  const consumedState = await env.DB.prepare(`
    DELETE FROM oauth_states
    WHERE state_hash = ? AND expires_at > ?
    RETURNING state_hash
  `).bind(stateHash, timestamp).first();

  if (!consumedState) {
    return errorRedirect(config.appUrl, "state", true, config.secureCookie);
  }

  if (callbackUrl.searchParams.has("error")) {
    return errorRedirect(config.appUrl, "denied", true, config.secureCookie);
  }

  const code = codes[0];
  if (!code || code.length > 2048) {
    return errorRedirect(config.appUrl, "callback", true, config.secureCookie);
  }

  const tokenResult = await exchangeAuthorizationCode(fetchImpl, config, code);
  if (tokenResult.error) {
    return errorRedirect(config.appUrl, "oauth", true, config.secureCookie);
  }

  const profileResult = await fetchDiscordProfile(fetchImpl, tokenResult.accessToken);
  if (profileResult.error) {
    return errorRedirect(config.appUrl, "profile", true, config.secureCookie);
  }

  const user = await upsertUser(env.DB, profileResult.profile);
  const sessionToken = createRandomToken();
  const sessionHash = await sha256Hex(sessionToken);
  const createdAt = nowIso();
  const expiresAt = addSeconds(createdAt, config.sessionTtlSeconds);

  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionHash, user.id, createdAt, expiresAt).run();

  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: new URL("/", config.appUrl).href,
  });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, sessionToken, {
    path: "/",
    maxAge: config.sessionTtlSeconds,
    secure: config.secureCookie,
  }));
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE, "/api/auth", config.secureCookie));

  return new Response(null, { status: 303, headers });
}

export async function handleCurrentUser({ request, env }) {
  if (request.method !== "GET") {
    return methodNotAllowed("GET");
  }
  assertDatabase(env);

  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (!sessionToken || sessionToken.length > 128) {
    return jsonResponse({ user: null });
  }

  const timestamp = nowIso();
  const tokenHash = await sha256Hex(sessionToken);
  const user = await env.DB.prepare(`
    SELECT users.id, users.discord_id, users.display_name, users.avatar_hash
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).bind(tokenHash, timestamp).first();

  if (!user) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ? AND expires_at <= ?")
      .bind(tokenHash, timestamp)
      .run();
    return jsonResponse({ user: null });
  }

  return jsonResponse({ user: publicUser(user) });
}

export async function handleLogout({ request, env }) {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  const appUrl = getAppUrl(env);
  const secureCookie = appUrl.protocol === "https:";
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (
    origin !== appUrl.origin
    || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
  ) {
    return jsonResponse(
      { error: { code: "CSRF_REJECTED", message: "Origem da solicitação não permitida." } },
      403,
    );
  }

  assertDatabase(env);
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (sessionToken && sessionToken.length <= 128) {
    const tokenHash = await sha256Hex(sessionToken);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": clearCookie(SESSION_COOKIE, "/", secureCookie),
    },
  });
}
