/**
 * Cloudflare Pages Function — /api/auth/discord
 * Endpoint de autenticação OAuth2 do Discord (importa user_id, username e avatar).
 */
import {
  assertSessionSecret,
  createOAuthState,
  oauthStateCookie,
} from "../../_lib/session.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return Response.json(
      { ok: false, error: "discord_oauth_not_configured" },
      { status: 503 },
    );
  }

  try {
    assertSessionSecret(env.SESSION_SECRET);
  } catch (error) {
    return Response.json(
      { ok: false, error: "session_signing_not_configured" },
      { status: 503 },
    );
  }

  const state = createOAuthState();
  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({
    Location: authorizeUrl.href,
    "Set-Cookie": oauthStateCookie(state, request),
  });
  return new Response(null, { status: 302, headers });
}
