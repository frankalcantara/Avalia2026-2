import { configured, createState, failure, redirect, stateCookie } from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return failure(503, 'auth_not_configured', 'Autenticação Discord ainda não configurada.');
  if (!env.DB) return failure(503, 'database_unavailable', 'Banco de dados indisponível.');
  const { nonce, token } = await createState(env.SESSION_SECRET);
  const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', new URL('/api/auth/discord/callback', request.url).href);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'identify');
  authorizeUrl.searchParams.set('state', nonce);
  return redirect(authorizeUrl.href, [stateCookie(token)]);
}
