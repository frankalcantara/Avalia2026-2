import { json } from "../../_shared/http.js";
import {
  createOAuthState,
  setOAuthStateCookie,
} from "../../_shared/session.js";

export async function onRequestGet({ request, env }) {
  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    typeof env.SESSION_SECRET !== "string" ||
    env.SESSION_SECRET.length < 32
  ) {
    return json({
      error: {
        code: "oauth_not_configured",
        message: "Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET para habilitar o login.",
      },
    }, 503);
  }

  if (!env.DB) {
    return json({
      error: {
        code: "database_unavailable",
        message: "O binding D1 DB é necessário para autenticar usuários.",
      },
    }, 503);
  }

  const url = new URL(request.url);
  const redirectUri = env.DISCORD_REDIRECT_URI ||
    new URL("/api/auth/discord/callback", url.origin).href;
  const state = createOAuthState();
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Cache-Control": "no-store",
      "Set-Cookie": setOAuthStateCookie(request, state),
    },
  });
}
