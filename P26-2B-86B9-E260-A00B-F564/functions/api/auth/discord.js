/**
 * Cloudflare Pages Function — GET /api/auth/discord
 * Inicia o fluxo OAuth2 do Discord com proteção de state (CSRF).
 */
import { createStateCookie } from "../_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.redirect(new URL("/?auth_error=not_configured", url.origin).href, 302);
  }

  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

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
      "Set-Cookie": createStateCookie(state, request),
    },
  });
}
