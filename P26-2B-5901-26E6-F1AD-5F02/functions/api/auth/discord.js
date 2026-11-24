import { cookie } from '../../_lib.js';
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const p = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify', state,
    redirect_uri: url.origin + '/api/auth/discord/callback' });
  return new Response(null, { status: 302, headers: {
    Location: 'https://discord.com/oauth2/authorize?' + p, 'Set-Cookie': cookie('oauth_state', state, 600) } });
}
