const STATE_COOKIE = "discord_oauth_state";
const SESSION_COOKIE = "discord_session";

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const prefix = `${name}=`;
  const cookie = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

function randomHex(bytesLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function redirectWithError(url, error) {
  const target = new URL("/", url.origin);
  target.searchParams.set("auth_error", error);
  const response = new Response(null, { status: 302, headers: { Location: target.href } });
  response.headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  return response;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = getCookie(request, STATE_COOKIE);

  if (!state || !stateCookie || state !== stateCookie) {
    return redirectWithError(url, "invalid_state");
  }

  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code) {
    return redirectWithError(url, oauthError ? "oauth_denied" : "missing_code");
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return redirectWithError(url, "missing_credentials");
  }

  if (!env.DB) {
    console.error("Discord OAuth callback failed: D1 binding is not configured.");
    return redirectWithError(url, "database_unavailable");
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
      console.error("Discord OAuth token exchange failed:", tokenRes.status);
      return redirectWithError(url, "token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      console.error("Discord OAuth token response did not contain an access token.");
      return redirectWithError(url, "token_exchange_failed");
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      console.error("Discord profile request failed:", userRes.status);
      return redirectWithError(url, "fetch_user_failed");
    }

    const discordUser = await userRes.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    if (typeof userId !== "string" || !userId || typeof username !== "string" || !username) {
      console.error("Discord profile response is missing a valid user ID or username.");
      return redirectWithError(url, "invalid_profile");
    }

    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();

    const sessionId = randomHex(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, userId, expiresAt).run();

    const response = new Response(null, {
      status: 302,
      headers: { Location: new URL("/?login=success", url.origin).href },
    });
    response.headers.append(
      "Set-Cookie",
      `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );
    return response;
  } catch (error) {
    console.error("Discord OAuth callback failed:", error);
    return redirectWithError(url, "exception");
  }
}
