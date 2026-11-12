import {
  SESSION_COOKIE, SESSION_MAX_AGE, STATE_COOKIE, clearStateCookie, cookie,
  hashToken, isToken, jsonError, randomToken, readToken,
} from "../../../../lib/auth.js";

/** Troca o código OAuth2 pelo perfil e cria uma sessão opaca persistida no D1. */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = readToken(request, STATE_COOKIE);
  const failureHeaders = { "Set-Cookie": clearStateCookie() };

  function redirectError(error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL(`/?auth_error=${encodeURIComponent(error)}`, url.origin).href,
        "Cache-Control": "no-store",
        ...failureHeaders,
      },
    });
  }

  if (!isToken(state) || !stateCookie || state !== stateCookie) {
    return jsonError("invalid_state", 400, failureHeaders);
  }

  const code = url.searchParams.get("code");
  if (url.searchParams.has("error") || !code) {
    return redirectError(url.searchParams.has("error") ? "oauth_denied" : "missing_code");
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return jsonError("missing_credentials", 503, failureHeaders);
  }
  if (!env.DB) return jsonError("database_unavailable", 503, failureHeaders);

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

    if (!tokenRes.ok) return redirectError("token_exchange_failed");

    const tokenData = await tokenRes.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      return redirectError("invalid_token_response");
    }
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) return redirectError("fetch_user_failed");

    const discordUser = await userRes.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    if (typeof userId !== "string" || !/^\d{1,20}$/.test(userId)
      || typeof username !== "string" || !username.trim() || username.length > 80
      || (discordUser.avatar != null
        && (typeof discordUser.avatar !== "string"
          || !/^(a_)?[a-f0-9]{32}$/i.test(discordUser.avatar)))) {
      return redirectError("invalid_profile");
    }

    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const token = randomToken();
    const tokenHash = await hashToken(token);

    try {
      const statements = [
        env.DB.prepare(
          `INSERT INTO discord_users (user_id, username, avatar, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET username = excluded.username,
             avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP`
        ).bind(userId, username, avatar),
        env.DB.prepare(
          "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, unixepoch() + ?)"
        ).bind(tokenHash, userId, SESSION_MAX_AGE),
      ];
      const previousToken = readToken(request);
      if (previousToken) {
        statements.push(env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
          .bind(await hashToken(previousToken)));
      }
      const results = await env.DB.batch(statements);
      if (results.some((result) => result.success === false)) throw new Error("Falha D1");
    } catch {
      return jsonError("database_unavailable", 503, failureHeaders);
    }

    const headers = new Headers({
      Location: "/?login=success",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", clearStateCookie());
    headers.append("Set-Cookie", cookie(SESSION_COOKIE, token, SESSION_MAX_AGE));
    return new Response(null, { status: 302, headers });
  } catch {
    return redirectError("oauth_failed");
  }
}
