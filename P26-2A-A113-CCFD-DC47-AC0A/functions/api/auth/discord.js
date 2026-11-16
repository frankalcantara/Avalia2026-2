/**
 * GET /api/auth/discord — inicia o OAuth2 do Discord (escopo identify) com parâmetro `state` anti-CSRF.
 */
import { json, buildCookie, STATE_COOKIE } from "../../_lib/util.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET (.dev.vars local ou variáveis do Cloudflare Pages).",
    }, 500);
  }

  const state = crypto.randomUUID();
  const authorize = new URL("https://discord.com/api/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", new URL("/api/auth/discord/callback", url.origin).href);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);

  const headers = new Headers({ Location: authorize.href });
  headers.append("Set-Cookie", buildCookie(STATE_COOKIE, state, request, 600));
  return new Response(null, { status: 302, headers });
}
