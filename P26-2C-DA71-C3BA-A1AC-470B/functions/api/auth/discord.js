// GET /api/auth/discord — inicia o OAuth2: gera state, grava cookie e redireciona.
import { error, redirect } from "../../_lib/http.js";
import { serializeCookie } from "../../_lib/cookies.js";
import { randomHex } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID) {
    return error(503, "oauth_not_configured", "Login com Discord não está configurado neste ambiente.");
  }
  const state = randomHex(16);
  const origin = new URL(request.url).origin;

  const auth = new URL("https://discord.com/oauth2/authorize");
  auth.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "identify");
  auth.searchParams.set("redirect_uri", origin + "/api/auth/discord/callback");
  auth.searchParams.set("state", state);

  return redirect(auth.href, [serializeCookie("oauth_state", state, 600)]);
}
