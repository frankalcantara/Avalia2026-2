import { redirect } from '../../_lib/http.js';
import { randomHex } from '../../_lib/session.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = randomHex(16);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare('INSERT INTO oauth_states (state, expires_at) VALUES (?, ?)')
    .bind(state, now + 600)
    .run();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: `${url.origin}/api/auth/callback`,
    scope: 'identify',
    state,
  });
  return redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
