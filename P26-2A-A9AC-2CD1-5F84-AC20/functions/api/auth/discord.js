import { cookie, randomToken, fail } from '../../_lib.js';

// Inicia o login: redireciona para o Discord com um "state" anti-CSRF.
export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return fail(500, 'Login do Discord não configurado.');
  const url = new URL(request.url);
  const state = randomToken();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${url.origin}/api/auth/discord/callback`,
    scope: 'identify',
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://discord.com/oauth2/authorize?${params}`,
      'Set-Cookie': cookie('oauth_state', state, url, 600),
      'Cache-Control': 'no-store',
    },
  });
}
