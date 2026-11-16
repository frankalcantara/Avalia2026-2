import { buildCookie } from '../../../lib/session.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clientId = (env.DISCORD_CLIENT_ID || '').trim();
  const redirectUri = (env.DISCORD_REDIRECT_URI || new URL('/api/auth/callback', url.origin).href).trim();

  if (!clientId) {
    return new Response('Configuração OAuth2 incompleta: DISCORD_CLIENT_ID ausente.', { status: 500 });
  }

  const state = crypto.randomUUID();
  const isHttps = url.protocol === 'https:';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  });

  const authorizeUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': buildCookie('oauth_state', state, { maxAge: 600, isHttps }),
    },
  });
}
