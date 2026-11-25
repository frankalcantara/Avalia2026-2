/**
 * Cloudflare Pages Function — GET /api/auth/discord
 * Inicia o fluxo Discord OAuth2 com proteção CSRF via state em cookie HttpOnly.
 */
import { buildOAuthStateCookie, generateSecureToken } from "../../../src/server/auth.js";
import { jsonResponse } from "../../../src/server/http.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env?.DISCORD_CLIENT_ID || !env?.DISCORD_CLIENT_SECRET) {
    const accept = (request.headers.get("Accept") || "").toLowerCase();
    if (accept.includes("application/json")) {
      return jsonResponse(
        {
          ok: false,
          configured: false,
          code: "OAUTH_NOT_CONFIGURED",
          error:
            "Discord OAuth2 não configurado neste ambiente. Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET.",
        },
        503
      );
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?auth_error=oauth_not_configured",
        "Cache-Control": "no-store",
      },
    });
  }

  const state = generateSecureToken(24);
  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({
    Location: authorizeUrl.href,
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", buildOAuthStateCookie(state, request, 600));

  return new Response(null, { status: 302, headers });
}
