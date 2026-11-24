// GET /api/auth/login — inicia o fluxo OAuth2 do Discord (scope identify).
import { COOKIE_STATE, OAUTH_STATE_TTL_S } from '../../_lib/config.js';
import { randomToken } from '../../_lib/auth.js';
import { fail, handle, isHttps, redirect, serializeCookie } from '../../_lib/http.js';

export const onRequestGet = handle(async ({ request, env }) => {
  if (!env.DISCORD_CLIENT_ID) return fail(500, 'config', 'DISCORD_CLIENT_ID não configurado.');
  const url = new URL(request.url);
  const state = randomToken(16);
  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify',
    state,
    prompt: 'none',
  }).toString();

  return redirect(authorize.toString(), [
    serializeCookie(COOKIE_STATE, state, { maxAge: OAUTH_STATE_TTL_S, secure: isHttps(request) }),
  ]);
});
