import { cookie, databaseFailure, failure, readCookie, requireDatabase, randomToken, sha256 } from "../../../_shared.js";

const STATE_COOKIE_PATH = "/api/auth/discord/callback";

function redirectWithCookie(location, stateCookie) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", stateCookie);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return failure("oauth_not_configured", 503, "Configure as credenciais OAuth2 do Discord.");
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = readCookie(request, "discord_oauth_state");
  const clearStateCookie = cookie("discord_oauth_state", "", 0, STATE_COOKIE_PATH);
  if (url.searchParams.has("error") || !state || !stateCookie || state !== stateCookie) {
    return redirectWithCookie("/?auth_error=invalid_oauth_state", clearStateCookie);
  }

  let consumed;
  try {
    const stateHash = await sha256(state);
    consumed = await env.DB.prepare(
      "DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING state_hash"
    ).bind(stateHash, new Date().toISOString()).first();
  } catch {
    return databaseFailure();
  }
  if (!consumed) return redirectWithCookie("/?auth_error=invalid_oauth_state", clearStateCookie);

  const code = url.searchParams.get("code");
  if (!code) return redirectWithCookie("/?auth_error=missing_code", clearStateCookie);

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  let profile;
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
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
    if (!tokenResponse.ok) return redirectWithCookie("/?auth_error=token_exchange_failed", clearStateCookie);

    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string") {
      return redirectWithCookie("/?auth_error=token_exchange_failed", clearStateCookie);
    }

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) return redirectWithCookie("/?auth_error=profile_fetch_failed", clearStateCookie);

    profile = await profileResponse.json();
    if (typeof profile.id !== "string" || typeof profile.username !== "string") {
      return redirectWithCookie("/?auth_error=invalid_profile", clearStateCookie);
    }
  } catch {
    return redirectWithCookie("/?auth_error=oauth_failed", clearStateCookie);
  }

  const avatar = typeof profile.avatar === "string"
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.${profile.avatar.startsWith("a_") ? "gif" : "png"}`
    : "https://cdn.discordapp.com/embed/avatars/0.png";
  const now = new Date();
  try {
    await env.DB.prepare(
      `INSERT INTO discord_users (user_id, username, global_name, avatar, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         global_name = excluded.global_name,
         avatar = excluded.avatar,
         updated_at = excluded.updated_at`
    ).bind(profile.id, profile.username, profile.global_name || null, avatar, now.toISOString()).run();
  } catch {
    return databaseFailure();
  }

  const sessionToken = await randomToken();
  const tokenHash = await sha256(sessionToken);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  try {
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(tokenHash, profile.id, now.toISOString(), expiresAt.toISOString()).run();
  } catch {
    return databaseFailure();
  }

  const headers = new Headers({ Location: "/?login=success", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearStateCookie);
  headers.append("Set-Cookie", cookie("discord_session", sessionToken, 7 * 24 * 60 * 60));
  return new Response(null, { status: 302, headers });
}
