/**
 * Cloudflare Pages Function: /api/auth/discord
 * Starts the Discord OAuth2 flow (scope "identify") with a random "state" value
 * stored in a short-lived cookie, which the callback checks against forgery (CSRF).
 */
import { cookie, json, randomHex } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID) {
    return json(
      {
        ok: false,
        error: "missing_credentials",
        message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages.",
      },
      500
    );
  }

  const url = new URL(request.url);
  const state = randomHex(16);

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", new URL("/api/auth/discord/callback", url.origin).href);
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({ Location: authorizeUrl.href });
  headers.append("Set-Cookie", cookie("oauth_state", state, 600));
  return new Response(null, { status: 302, headers });
}
