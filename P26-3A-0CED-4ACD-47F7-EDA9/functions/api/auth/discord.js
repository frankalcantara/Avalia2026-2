/**
 * GET /api/auth/discord
 * Inicia o OAuth2 do Discord (escopos identify + guilds) com parâmetro state contra CSRF.
 */
import { OAUTH_COOKIE, OAUTH_MAX_AGE } from "../../../src/config.js";
import { authorizeUrl, safeReturnTo } from "../../../src/discord.js";
import { HttpError, cookie, methodNotAllowed, redirect } from "../../../src/http.js";
import { randomToken } from "../../../src/session.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new HttpError(500, "server_misconfigured", "DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET não configurados.");
  }
  const url = new URL(request.url);
  const state = randomToken(16);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const oauthCookie = cookie(OAUTH_COOKIE, JSON.stringify({ state, returnTo }), OAUTH_MAX_AGE);
  return redirect(authorizeUrl(env, url.origin, state), [oauthCookie]);
}

export const onRequest = () => methodNotAllowed();
