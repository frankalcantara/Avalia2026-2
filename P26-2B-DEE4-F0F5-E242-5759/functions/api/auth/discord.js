import { cookie, newState, oauthConfigured, STATE_COOKIE } from "../../_shared/session.js";

/**
 * Cloudflare Pages Function — /api/auth/discord
 * Endpoint de autenticação OAuth2 do Discord (importa user_id, username e avatar).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!oauthConfigured(env)) {
    return Response.json({
      configured: false,
      message: "Configure as credenciais OAuth2 e o segredo de sessão.",
    }, { status: 503 });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");

  const state = newState();
  authorizeUrl.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": cookie(STATE_COOKIE, state, 600),
      "Cache-Control": "no-store",
    },
  });
}
