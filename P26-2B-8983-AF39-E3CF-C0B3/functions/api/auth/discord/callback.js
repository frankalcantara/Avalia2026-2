import {
  clearStateCookie,
  HttpError,
  json,
  methodNotAllowed,
  readOAuthStateCookie,
  requireDatabase,
  sessionCookie,
  signSession,
  validateDiscordProfile,
} from "../../../_utils.js";

function failure(message, status, headers = {}) {
  return json({ error: message }, status, { "Set-Cookie": clearStateCookie(), ...headers });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed("GET");
  const { request, env } = context;
  const url = new URL(request.url);
  const queryState = url.searchParams.get("state");
  const cookieState = readOAuthStateCookie(request);
  if (!queryState || !cookieState || queryState.length > 128 || queryState !== cookieState) {
    return failure("OAuth state validation failed", 400);
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) return failure("Discord authorization was denied", 400);
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return failure("Missing or invalid authorization code", 400);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return failure("Discord OAuth2 credentials are not configured", 503);
  }
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
    return failure("SESSION_SECRET must contain at least 32 characters", 503);
  }

  try {
    const db = requireDatabase(env);
    const redirectUri = env.DISCORD_REDIRECT_URI || new URL("/api/auth/discord/callback", url.origin).href;
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
    if (!tokenResponse.ok) return failure("Discord token exchange failed", 502);
    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      return failure("Discord returned an invalid access token", 502);
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userResponse.ok) return failure("Unable to retrieve Discord profile", 502);
    const user = validateDiscordProfile(await userResponse.json());
    await db.prepare(`
      INSERT INTO discord_users (user_id, username, avatar, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        avatar = excluded.avatar,
        updated_at = CURRENT_TIMESTAMP
    `).bind(user.userId, user.username, user.avatar).run();

    const token = await signSession(user, env);
    const headers = new Headers({
      Location: "/?login=success",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", sessionCookie(token));
    headers.append("Set-Cookie", clearStateCookie());
    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    if (error instanceof HttpError) return failure(error.message, error.status);
    return failure("Discord authentication failed", 500);
  }
}
