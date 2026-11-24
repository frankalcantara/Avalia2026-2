/**
 * GET /api/auth/discord — inicia o login OAuth2 do Discord.
 * Gera um "state" aleatório (proteção CSRF do OAuth), guarda em cookie e
 * redireciona para a tela de autorização do Discord pedindo o escopo "identify".
 */
import { redirect, cookie } from "../../../src/lib/http.js";
import { randomToken, isSecureRequest } from "../../../src/lib/session.js";
import { DISCORD_AUTHORIZE_URL, OAUTH_STATE_COOKIE, redirectUri } from "../../../src/lib/discord.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return redirect("/?auth_error=not_configured");
  }

  const state = randomToken(16);
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  return redirect(url.href, {
    "Set-Cookie": cookie(OAUTH_STATE_COOKIE, state, {
      maxAge: 600,
      path: "/api/auth",
      secure: isSecureRequest(request),
    }),
  });
}
