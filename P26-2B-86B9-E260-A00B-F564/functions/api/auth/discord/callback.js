/**
 * Cloudflare Pages Function — GET /api/auth/discord/callback
 * Troca o authorization code por token, importa user_id/username/avatar
 * do Discord, persiste no D1 e emite cookie de sessão assinado (HMAC).
 */
import {
  clearStateCookie,
  createSessionCookie,
  ensureSchema,
  readStateCookie,
} from "../../_lib.js";

function redirectTo(request, path) {
  const url = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(path, url.origin).href,
      "Set-Cookie": clearStateCookie(request),
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");

  if (error || !code) {
    return redirectTo(request, "/?auth_error=" + encodeURIComponent(error || "missing_code"));
  }

  const expectedState = readStateCookie(request);
  if (!expectedState || state !== expectedState) {
    return redirectTo(request, "/?auth_error=invalid_state");
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return redirectTo(request, "/?auth_error=not_configured");
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

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

    if (!tokenResponse.ok) {
      return redirectTo(request, "/?auth_error=token_exchange_failed");
    }

    const tokenData = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return redirectTo(request, "/?auth_error=fetch_user_failed");
    }

    const discordUser = await userResponse.json();
    const userId = String(discordUser.id || "").trim();
    const username = String(discordUser.global_name || discordUser.username || "").trim();
    if (!userId || !username) {
      return redirectTo(request, "/?auth_error=fetch_user_failed");
    }

    let avatar = "https://cdn.discordapp.com/embed/avatars/0.png";
    if (discordUser.avatar) {
      const extension = String(discordUser.avatar).startsWith("a_") ? "gif" : "png";
      avatar = `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.${extension}?size=128`;
    }

    if (env.DB) {
      await ensureSchema(env);
      await env.DB.prepare(
        `INSERT INTO discord_users (user_id, username, avatar, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           username = excluded.username,
           avatar = excluded.avatar,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(userId, username, avatar)
        .run();
    }

    const sessionCookie = await createSessionCookie(env, { userId, username, avatar }, request);
    const headers = new Headers({ Location: "/?login=success" });
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", clearStateCookie(request));

    return new Response(null, { status: 302, headers });
  } catch {
    return redirectTo(request, "/?auth_error=exception");
  }
}
