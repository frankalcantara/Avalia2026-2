import {
  buildCookie,
  createSessionValue,
  getCookie,
  json,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../_lib/session.js";

function redirectWithAuthError(request, error) {
  const location = new URL("/", request.url);
  location.searchParams.set("auth_error", error);

  return new Response(null, {
    status: 302,
    headers: {
      Location: location.href,
      "Set-Cookie": buildCookie(request, "oauth_state", "", 0),
    },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, "oauth_state");

  if (!state || !savedState || state !== savedState) {
    return redirectWithAuthError(request, "invalid_state");
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) return redirectWithAuthError(request, "discord_authorization_denied");

  const code = url.searchParams.get("code");
  if (!code) return redirectWithAuthError(request, "missing_code");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return json(
      { ok: false, error: "Discord OAuth or session configuration is missing." },
      500,
    );
  }

  if (!env.DB) {
    return json({ ok: false, error: "D1 database is not configured." }, 500);
  }

  const redirectUri = new URL("/api/auth/discord/callback", request.url).href;
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

  if (!tokenResponse.ok) return redirectWithAuthError(request, "token_exchange_failed");

  const tokenData = await tokenResponse.json();
  if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
    return redirectWithAuthError(request, "token_exchange_failed");
  }

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResponse.ok) return redirectWithAuthError(request, "fetch_user_failed");

  const discordUser = await userResponse.json();
  if (typeof discordUser.id !== "string" || typeof discordUser.username !== "string") {
    return redirectWithAuthError(request, "invalid_discord_user");
  }

  const userId = discordUser.id;
  const username = discordUser.username;
  const globalName =
    typeof discordUser.global_name === "string" ? discordUser.global_name : null;
  const avatar = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.${discordUser.avatar.startsWith("a_") ? "gif" : "png"}`
    : null;

  await env.DB.prepare(
    "INSERT INTO discord_users (user_id, username, global_name, avatar) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, global_name = excluded.global_name, avatar = excluded.avatar",
  )
    .bind(userId, username, globalName, avatar)
    .run();

  const sessionValue = await createSessionValue(userId, env);
  const headers = new Headers({
    Location: new URL("/?login=success", request.url).href,
  });
  headers.append(
    "Set-Cookie",
    buildCookie(request, SESSION_COOKIE_NAME, sessionValue, SESSION_MAX_AGE_SECONDS),
  );
  headers.append("Set-Cookie", buildCookie(request, "oauth_state", "", 0));

  return new Response(null, { status: 302, headers });
}
