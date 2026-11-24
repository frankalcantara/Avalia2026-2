/**
 * Cloudflare Pages Function — GET /api/auth/discord
 * Inicia o OAuth2 do Discord (scope "identify": id, username e avatar).
 * Gera um "state" aleatório, guardado em cookie, para proteger contra CSRF no login.
 */
import { buildCookie, randomToken } from "../../_lib/util.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID (wrangler.jsonc) e DISCORD_CLIENT_SECRET (secret do Cloudflare Pages).",
    });
  }

  const state = randomToken(16);
  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": buildCookie("oauth_state", state, { maxAge: 600 }),
      "Cache-Control": "no-store",
    },
  });
}
