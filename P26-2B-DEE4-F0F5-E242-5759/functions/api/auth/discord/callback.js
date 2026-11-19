import { cookie, createSession, oauthConfigured, readCookie, STATE_COOKIE } from "../../../_shared/session.js";

function redirect(location, session) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
  if (session) headers.append("Set-Cookie", session);
  return new Response(null, { status: 302, headers });
}

/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Troca o authorization code pelo token de acesso do Discord, obtém o perfil (@me)
 * e persiste no Cloudflare D1 com cookie de sessão.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!state || !/^[a-f0-9]{64}$/.test(state) || state !== readCookie(request, STATE_COOKIE)) {
    return redirect("/?auth_error=invalid_state");
  }
  if (!code || url.searchParams.has("error")) return redirect("/?auth_error=authorization_failed");

  if (!oauthConfigured(env) || !env.DB) {
    return Response.json({
      ok: false,
      error: "missing_credentials",
    }, { status: 503 });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
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

    if (!tokenRes.ok) {
      return redirect("/?auth_error=token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    if (typeof tokenData?.access_token !== "string" || !tokenData.access_token) {
      return redirect("/?auth_error=token_exchange_failed");
    }
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return redirect("/?auth_error=fetch_user_failed");
    }

    const discordUser = await userRes.json();
    const { id: userId, username } = discordUser;
    if (typeof userId !== "string" || !/^\d{1,20}$/.test(userId) ||
        typeof username !== "string" || !username.trim() || username.length > 80 ||
        (discordUser.avatar !== null && (typeof discordUser.avatar !== "string" ||
          !/^(a_)?[a-f0-9]{32}$/.test(discordUser.avatar)))) {
      return redirect("/?auth_error=invalid_profile");
    }
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();
    return redirect("/?login=success", await createSession(env, userId));
  } catch {
    return redirect("/?auth_error=exception");
  }
}
