import { getDiscordAuthConfig } from "../../_lib/auth-config.js";
import { json } from "../../_lib/http.js";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE, serializeCookie } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const authConfig = getDiscordAuthConfig(env);
  if (!authConfig) {
    return json({
      ok: false,
      error: "auth_not_configured",
      message: "Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET (com pelo menos 32 caracteres) no .env local ou no Cloudflare Pages.",
    }, 503);
  }

  const state = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", authConfig.clientId);
  authorizeUrl.searchParams.set("redirect_uri", new URL("/api/auth/discord/callback", url.origin).href);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": serializeCookie(OAUTH_STATE_COOKIE, state, request, OAUTH_STATE_MAX_AGE),
      "Cache-Control": "no-store",
    },
  });
}
