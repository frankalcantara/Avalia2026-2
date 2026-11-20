/**
 * Cloudflare Pages Function — GET /api/auth/discord/callback
 * Valida state CSRF, troca code por access_token no Discord, importa perfil (@me),
 * persiste usuário e sessão opaca no Cloudflare D1 e define cookie HttpOnly.
 */
import {
  OAUTH_STATE_COOKIE_NAME,
  buildClearOAuthStateCookie,
  buildSessionCookie,
  constantTimeEqual,
  createSession,
} from "../../../../src/server/auth.js";
import { ensureSchema } from "../../../../src/server/db.js";
import { errorResponse, parseCookies } from "../../../../src/server/http.js";

function redirectWithClearedState(request, path) {
  const headers = new Headers({
    Location: path,
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", buildClearOAuthStateCookie(request));
  return new Response(null, { status: 302, headers });
}

function resolveDiscordAvatar(discordUser) {
  const userId = String(discordUser.id);
  if (discordUser.avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`;
  }

  let defaultIndex = 0;
  try {
    if (discordUser.discriminator && discordUser.discriminator !== "0") {
      defaultIndex = Number(discordUser.discriminator) % 5;
    } else {
      defaultIndex = Number((BigInt(userId) >> 22n) % 6n);
    }
  } catch {
    defaultIndex = 0;
  }

  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithClearedState(
      request,
      `/?auth_error=${encodeURIComponent(oauthError)}`
    );
  }

  const cookies = parseCookies(request);
  const expectedState = cookies[OAUTH_STATE_COOKIE_NAME];

  if (!code || !state || !expectedState || !constantTimeEqual(state, expectedState)) {
    return redirectWithClearedState(request, "/?auth_error=invalid_state");
  }

  if (!env?.DISCORD_CLIENT_ID || !env?.DISCORD_CLIENT_SECRET) {
    const accept = (request.headers.get("Accept") || "").toLowerCase();
    if (accept.includes("application/json")) {
      return errorResponse(
        "Discord OAuth2 não configurado neste ambiente.",
        "OAUTH_NOT_CONFIGURED",
        503
      );
    }
    return redirectWithClearedState(request, "/?auth_error=oauth_not_configured");
  }

  if (!env?.DB) {
    return redirectWithClearedState(request, "/?auth_error=db_unavailable");
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithClearedState(request, "/?auth_error=token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    if (!tokenData?.access_token) {
      return redirectWithClearedState(request, "/?auth_error=missing_access_token");
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userRes.ok) {
      return redirectWithClearedState(request, "/?auth_error=fetch_user_failed");
    }

    const discordUser = await userRes.json();
    if (!discordUser?.id || (!discordUser?.global_name && !discordUser?.username)) {
      return redirectWithClearedState(request, "/?auth_error=invalid_discord_profile");
    }

    const userId = String(discordUser.id);
    const username = String(discordUser.global_name || discordUser.username)
      .trim()
      .slice(0, 80);
    const avatar = resolveDiscordAvatar(discordUser);

    await ensureSchema(env.DB);

    await env.DB
      .prepare(
        `INSERT INTO discord_users (user_id, username, avatar, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           username = excluded.username,
           avatar = excluded.avatar,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(userId, username, avatar)
      .run();

    const { token } = await createSession(env.DB, userId);

    const headers = new Headers({
      Location: "/?login=success",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", buildSessionCookie(token, request));
    headers.append("Set-Cookie", buildClearOAuthStateCookie(request));

    return new Response(null, { status: 302, headers });
  } catch {
    return redirectWithClearedState(request, "/?auth_error=oauth_exception");
  }
}
