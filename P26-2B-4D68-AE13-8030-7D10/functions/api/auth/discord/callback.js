import { getDiscordAuthConfig } from "../../../_lib/auth-config.js";
import { json } from "../../../_lib/http.js";
import {
  clearedCookie, OAUTH_STATE_COOKIE, readCookie, sessionCookie, signSession,
} from "../../../_lib/session.js";
import { isDiscordUserId } from "../../../_lib/validation.js";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_PROFILE_URL = "https://discord.com/api/users/@me";

function authFailure(request, error, status = 400) {
  return json({ ok: false, error }, status, {
    "Set-Cookie": clearedCookie(OAUTH_STATE_COOKIE, request),
  });
}

async function exchangeCode(authConfig, code, redirectUri) {
  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: authConfig.clientId,
      client_secret: authConfig.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) return null;
  const token = await response.json();
  return typeof token.access_token === "string" ? token.access_token : null;
}

async function fetchProfile(accessToken) {
  const response = await fetch(DISCORD_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const profile = await response.json();
  if (!isDiscordUserId(profile.id) || typeof profile.username !== "string") return null;
  return {
    userId: String(profile.id),
    username: String(profile.global_name || profile.username).slice(0, 80),
    avatar: profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png",
  };
}

async function upsertUser(db, user) {
  await db.prepare(`
    INSERT INTO discord_users (user_id, username, avatar, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP
  `).bind(user.userId, user.username, user.avatar).run();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.has("error")) return authFailure(request, "discord_authorization_denied");

  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const expectedState = readCookie(request, OAUTH_STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState || !code) {
    return authFailure(request, "invalid_oauth_state");
  }

  const authConfig = getDiscordAuthConfig(env);
  if (!authConfig) return authFailure(request, "auth_not_configured", 503);
  if (!env.DB) return authFailure(request, "database_unavailable", 503);

  try {
    const accessToken = await exchangeCode(
      authConfig,
      code,
      new URL("/api/auth/discord/callback", url.origin).href,
    );
    if (!accessToken) return authFailure(request, "token_exchange_failed");

    const user = await fetchProfile(accessToken);
    if (!user) return authFailure(request, "invalid_discord_profile");

    await upsertUser(env.DB, user);

    const session = await signSession(user, authConfig.sessionSecret);
    const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
    headers.append("Set-Cookie", sessionCookie(session, request));
    headers.append("Set-Cookie", clearedCookie(OAUTH_STATE_COOKIE, request));
    return new Response(null, { status: 302, headers });
  } catch {
    return authFailure(request, "authentication_failed", 502);
  }
}
