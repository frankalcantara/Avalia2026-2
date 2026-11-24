import { buildAuthorizeUrl } from '../../../lib/discord.js';
import { redirect } from '../../../lib/http.js';
import { randomToken, serializeCookie, STATE_COOKIE } from '../../../lib/session.js';

// GET /api/auth/discord — inicia o OAuth2 do Discord com um "state" anti-CSRF em cookie.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return redirect('/?erro=config');
  }
  const state = randomToken();
  const redirectUri = `${url.origin}/api/auth/discord/callback`;
  return redirect(buildAuthorizeUrl(env.DISCORD_CLIENT_ID, redirectUri, state), [
    serializeCookie(STATE_COOKIE, state, { maxAge: 600, secure: url.protocol === 'https:' }),
  ]);
}
