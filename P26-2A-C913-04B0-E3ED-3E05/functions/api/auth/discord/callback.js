import {
  sessionCookie,
  signValue,
  verifyValue,
} from "../../_shared/auth.js";

const CALLBACK_PATH = "/api/auth/discord/callback";
const STATE_COOKIE_NAME = "discord_oauth_state";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function redirectWithError(origin, error) {
  const destination = new URL("/", origin);
  destination.searchParams.set("auth_error", error);
  return new Response(null, {
    status: 302,
    headers: { Location: destination.href },
  });
}

function readStateCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  return cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${STATE_COOKIE_NAME}=([^;]+)`),
  )?.[1];
}

async function validateState(request, env, returnedState) {
  const signedState = readStateCookie(request);
  const stateJson = await verifyValue(signedState, env);

  try {
    const state = JSON.parse(stateJson || "null");
    return Boolean(
      state
        && state.state === returnedState
        && state.expiresAt >= Date.now(),
    );
  } catch {
    return false;
  }
}

function getRedirectUri(env, origin) {
  const callbackUrl = new URL(CALLBACK_PATH, origin).href;
  if (!env.DISCORD_REDIRECT_URI) return callbackUrl;

  try {
    const configuredUrl = new URL(env.DISCORD_REDIRECT_URI);
    return configuredUrl.href === callbackUrl ? configuredUrl.href : callbackUrl;
  } catch {
    return callbackUrl;
  }
}

function avatarUrl(userId, avatarHash) {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
  }

  const defaultAvatarIndex = Number(BigInt(userId) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
}

async function exchangeCode(code, env, redirectUri) {
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) throw new Error("token_exchange_failed");
  return response.json();
}

async function fetchDiscordProfile(accessToken) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error("profile_fetch_failed");
  return response.json();
}

async function saveDiscordUser(db, user) {
  await db
    .prepare(`
      INSERT INTO discord_users (user_id, username, avatar, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        avatar = excluded.avatar,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(user.userId, user.username, user.avatar)
    .run();
}

function clearStateCookie() {
  return `${STATE_COOKIE_NAME}=; Path=${CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const validState = await validateState(request, env, returnedState);

  if (url.searchParams.has("error") || !code || !validState) {
    const response = redirectWithError(url.origin, "state_validation_failed");
    response.headers.append("Set-Cookie", clearStateCookie());
    return response;
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return redirectWithError(url.origin, "oauth_not_configured");
  }

  const redirectUri = getRedirectUri(env, url.origin);

  try {
    const token = await exchangeCode(code, env, redirectUri);
    const profile = await fetchDiscordProfile(token.access_token);
    const userId = String(profile.id || "");
    const username = String(profile.global_name || profile.username || "").slice(0, 80);

    if (!/^\d{5,25}$/.test(userId) || !username) {
      return redirectWithError(url.origin, "invalid_profile");
    }

    const user = {
      userId,
      username,
      avatar: avatarUrl(userId, profile.avatar),
    };
    await saveDiscordUser(env.DB, user);

    const session = await signValue(
      JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_TTL_MS }),
      env,
    );
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: "/?login=success",
        "Cache-Control": "no-store",
      },
    });

    response.headers.append("Set-Cookie", sessionCookie(session));
    response.headers.append("Set-Cookie", clearStateCookie());
    return response;
  } catch (error) {
    const knownError = ["token_exchange_failed", "profile_fetch_failed"]
      .includes(error.message)
      ? error.message
      : "login_failed";
    return redirectWithError(url.origin, knownError);
  }
}
