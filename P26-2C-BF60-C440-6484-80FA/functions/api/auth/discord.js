// GET /api/auth/discord — inicia o OAuth2: gera state, grava cookie oauth_state e redireciona ao Discord.
import { errorResponse, route } from "../../../src/http.js";
import { randomToken, stateCookie, discordConfigured } from "../../../src/auth.js";
import { buildAuthorizeUrl } from "../../../src/discord.js";

export const onRequestGet = route(async ({ request, env }) => {
  if (!discordConfigured(env)) {
    return errorResponse(500, "not_configured", "Login Discord não configurado: defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET.");
  }
  const state = randomToken(32);
  const headers = new Headers({ Location: buildAuthorizeUrl(env, request.url, state), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", stateCookie(state));
  return new Response(null, { status: 302, headers });
});
