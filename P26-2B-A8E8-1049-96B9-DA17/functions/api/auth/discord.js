import { isHttps } from "../../_lib/http.js";
import { STATE_COOKIE, STATE_TTL, buildCookie, randomState, redirectUriFor } from "../../_lib/session.js";

/**
 * GET /api/auth/discord — inicia o OAuth2 (scope identify) com state anti-CSRF em cookie curto HttpOnly.
 */
export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=server_misconfigured", "Cache-Control": "no-store" },
    });
  }
  const state = randomState();
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUriFor(request));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Cache-Control": "no-store",
      "Set-Cookie": buildCookie(STATE_COOKIE, state, { maxAge: STATE_TTL, secure: isHttps(request), path: "/api/auth" }),
    },
  });
}
