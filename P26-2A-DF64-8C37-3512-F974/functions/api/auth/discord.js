// GET /api/auth/discord — inicia o fluxo OAuth2 (Authorization Code) do Discord.
import { errorResponse, redirect, serializeCookie } from '../../_lib/http.js';
import { randomToken } from '../../_lib/session.js';
import { redirectUri } from '../../_lib/decks.js';

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return errorResponse(500, 'DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET não configurados.', 'oauth_not_configured');
  }
  const state = randomToken(24);
  const auth = new URL('https://discord.com/oauth2/authorize');
  auth.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('redirect_uri', redirectUri(request, env));
  auth.searchParams.set('scope', 'identify');
  auth.searchParams.set('state', state);

  return redirect(auth.toString(), [
    serializeCookie('oauth_state', state, { maxAge: 600, path: '/api/auth' }),
  ]);
}
