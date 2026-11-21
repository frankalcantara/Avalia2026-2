export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({ erro: 'DISCORD_CLIENT_ID não configurado' }, { status: 500 });
  }
  const origem = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${origem}/api/auth/discord/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.href,
      'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}