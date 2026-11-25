import { json } from "../../../_shared/http.js";
import {
  clearOAuthStateCookie,
  createSignedSession,
  getOAuthState,
  setSessionCookie,
} from "../../../_shared/session.js";

function redirectWithStateCookie(request, location) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Set-Cookie": clearOAuthStateCookie(request),
    },
  });
}

function getRedirectUri(request, env) {
  return env.DISCORD_REDIRECT_URI ||
    new URL("/api/auth/discord/callback", new URL(request.url).origin).href;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const stateFromCookie = getOAuthState(request);
  const stateFromQuery = url.searchParams.get("state");

  if (!stateFromCookie || !stateFromQuery || stateFromCookie !== stateFromQuery) {
    return redirectWithStateCookie(request, "/?auth_error=invalid_state");
  }

  if (url.searchParams.has("error")) {
    return redirectWithStateCookie(request, "/?auth_error=discord_denied");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirectWithStateCookie(request, "/?auth_error=missing_code");
  }

  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    typeof env.SESSION_SECRET !== "string" ||
    env.SESSION_SECRET.length < 32
  ) {
    return json({
      error: {
        code: "oauth_not_configured",
        message: "Configure as credenciais Discord e SESSION_SECRET no ambiente.",
      },
    }, 503, { "Set-Cookie": clearOAuthStateCookie(request) });
  }
  if (!env.DB) {
    return json({
      error: {
        code: "database_unavailable",
        message: "O binding D1 DB é necessário para concluir o login.",
      },
    }, 503, { "Set-Cookie": clearOAuthStateCookie(request) });
  }

  try {
    const redirectUri = getRedirectUri(request, env);
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

    if (!tokenResponse.ok) {
      console.error("[Discord OAuth] Token exchange failed:", tokenResponse.status);
      return redirectWithStateCookie(request, "/?auth_error=token_exchange_failed");
    }

    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string") {
      console.error("[Discord OAuth] Token response did not contain an access token.");
      return redirectWithStateCookie(request, "/?auth_error=token_exchange_failed");
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userResponse.ok) {
      console.error("[Discord OAuth] Profile request failed:", userResponse.status);
      return redirectWithStateCookie(request, "/?auth_error=profile_fetch_failed");
    }

    const discordUser = await userResponse.json();
    if (
      typeof discordUser.id !== "string" ||
      typeof discordUser.username !== "string"
    ) {
      console.error("[Discord OAuth] Profile response was missing required fields.");
      return redirectWithStateCookie(request, "/?auth_error=invalid_profile");
    }

    const user = {
      userId: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatar: typeof discordUser.avatar === "string"
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
    };

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP",
    ).bind(user.userId, user.username, user.avatar).run();

    const signedSession = await createSignedSession(user, env.SESSION_SECRET);
    const headers = new Headers({
      Location: "/",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", clearOAuthStateCookie(request));
    headers.append("Set-Cookie", setSessionCookie(request, signedSession));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("[Discord OAuth] Callback failed:", error);
    return redirectWithStateCookie(request, "/?auth_error=callback_failed");
  }
}
