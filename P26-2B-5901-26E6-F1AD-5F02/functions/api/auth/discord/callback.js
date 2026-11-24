import { cookie, getCookie, now } from '../../../_lib.js';
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== getCookie(request, 'oauth_state'))
    return new Response('Estado OAuth inválido. Tente entrar novamente.', { status: 400 });

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code', code, redirect_uri: url.origin + '/api/auth/discord/callback' }) });
  if (!tokenRes.ok) return new Response('Falha ao trocar o código do Discord.', { status: 502 });
  const { access_token } = await tokenRes.json();

  const meRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + access_token } });
  if (!meRes.ok) return new Response('Falha ao ler o perfil do Discord.', { status: 502 });
  const me = await meRes.json();
  const avatar = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` : null;
  const name = me.global_name || me.username;

  await env.DB.prepare(
    `INSERT INTO users (id, name, avatar, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar`)
    .bind(me.id, name, avatar, now()).run();

  const token = crypto.randomUUID() + crypto.randomUUID();
  const maxAge = 7 * 86400;
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, me.id, now() + maxAge).run();

  const h = new Headers({ Location: '/' });
  h.append('Set-Cookie', cookie('session', token, maxAge));
  h.append('Set-Cookie', cookie('oauth_state', '', 0));
  return new Response(null, { status: 302, headers: h });
}
