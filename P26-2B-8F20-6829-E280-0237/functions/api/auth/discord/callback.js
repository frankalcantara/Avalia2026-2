/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Troca o authorization code pelo token de acesso do Discord, obtém o perfil (@me)
 * e persiste no Cloudflare D1 com cookie de sessão.
 */
import {
  assertSessionSecret,
  clearOAuthStateCookie,
  createSessionCookie,
  getCookie,
} from "../../../_lib/session.js";

function redirectError(url, request, error) {
  const location = new URL(`/?auth_error=${encodeURIComponent(error)}`, url.origin);
  const headers = new Headers({ Location: location.href });
  headers.append("Set-Cookie", clearOAuthStateCookie(request));
  return new Response(null, { status: 302, headers });
}

function jsonError(request, error, status) {
  const response = Response.json({ ok: false, error }, { status });
  response.headers.append("Set-Cookie", clearOAuthStateCookie(request));
  return response;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const expectedState = getCookie(request, "discord_oauth_state");
  const receivedState = url.searchParams.get("state");

  if (!expectedState || !receivedState || expectedState !== receivedState) {
    return redirectError(url, request, "invalid_state");
  }

  if (oauthError || !code) {
    return redirectError(url, request, oauthError ? "discord_authorization_denied" : "missing_code");
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return jsonError(request, "discord_oauth_not_configured", 503);
  }

  try {
    assertSessionSecret(env.SESSION_SECRET);
  } catch (error) {
    return jsonError(request, "session_signing_not_configured", 503);
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  let tokenRes;

  try {
    tokenRes = await fetch("https://discord.com/api/oauth2/token", {
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
  } catch (error) {
    console.error("Discord token endpoint request failed.", error);
    return jsonError(request, "discord_unavailable", 502);
  }

  if (!tokenRes.ok) {
    return redirectError(url, request, "token_exchange_failed");
  }

  let tokenData;
  try {
    tokenData = await tokenRes.json();
  } catch (error) {
    console.error("Discord token endpoint returned invalid JSON.", error);
    return jsonError(request, "discord_invalid_token_response", 502);
  }

  if (!tokenData || typeof tokenData.access_token !== "string" || !tokenData.access_token) {
    return jsonError(request, "discord_invalid_token_response", 502);
  }

  let userRes;
  try {
    userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch (error) {
    console.error("Discord user endpoint request failed.", error);
    return jsonError(request, "discord_unavailable", 502);
  }

  if (!userRes.ok) {
    return redirectError(url, request, "fetch_user_failed");
  }

  let discordUser;
  try {
    discordUser = await userRes.json();
  } catch (error) {
    console.error("Discord user endpoint returned invalid JSON.", error);
    return jsonError(request, "discord_invalid_user_response", 502);
  }

  const userId = discordUser && typeof discordUser.id === "string" ? discordUser.id : "";
  const rawUsername = discordUser && (discordUser.global_name || discordUser.username);
  const username = typeof rawUsername === "string" ? rawUsername.trim().slice(0, 80) : "";
  if (!/^\d{1,32}$/.test(userId) || !username) {
    return jsonError(request, "discord_invalid_user_response", 502);
  }

  const avatar = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(discordUser.avatar)}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  try {
    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
    ).bind(userId, username, avatar).run();
  } catch (error) {
    console.error("Failed to persist Discord user in D1.", error);
    return jsonError(request, "user_persistence_failed", 503);
  }

  let sessionCookie;
  try {
    sessionCookie = await createSessionCookie({ userId, username, avatar }, env.SESSION_SECRET, request);
  } catch (error) {
    console.error("Failed to create signed Discord session.", error);
    return jsonError(request, "session_creation_failed", 500);
  }

  const headers = new Headers({ Location: new URL("/?login=success", url.origin).href });
  headers.append("Set-Cookie", sessionCookie);
  headers.append("Set-Cookie", clearOAuthStateCookie(request));
  return new Response(null, { status: 302, headers });
}
