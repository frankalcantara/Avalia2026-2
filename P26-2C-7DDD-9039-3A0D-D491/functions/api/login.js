import {
  createRandomState,
  hasOAuthConfiguration,
  jsonResponse,
  methodNotAllowed,
  stateCookie
} from '../_utils.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed('GET');
  }
  if (!hasOAuthConfiguration(context.env)) {
    return jsonResponse({ error: 'Configure as credenciais do Discord e SESSION_SECRET no Cloudflare.' }, 503);
  }

  var state = createRandomState();
  var redirectUri = new URL('/api/callback', context.request.url).toString();
  var authorizeUrl = new URL('https://discord.com/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', context.env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'identify');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authorizeUrl.toString(),
      'Set-Cookie': stateCookie(state),
      'Cache-Control': 'no-store'
    }
  });
}
