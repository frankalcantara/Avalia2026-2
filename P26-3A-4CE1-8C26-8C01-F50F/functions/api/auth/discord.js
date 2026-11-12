import {
  STATE_COOKIE, STATE_MAX_AGE, cookie, jsonError, randomToken,
} from "../../../lib/auth.js";

/**
 * Cloudflare Pages Function — /api/auth/discord
 * Endpoint de autenticação OAuth2 do Discord (importa user_id, username e avatar).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages para login real.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  if (!env.DB) return jsonError("database_unavailable", 503);

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  const state = randomToken();
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Cache-Control": "no-store",
      "Set-Cookie": cookie(STATE_COOKIE, state, STATE_MAX_AGE, "/api/auth/discord"),
    },
  });
}
