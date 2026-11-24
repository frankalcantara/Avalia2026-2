import { cookie, getCookie, createSession } from '../../../_lib.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = (erro) => new Response(null, {
    status: 302,
    headers: { Location: `/?erro=${erro}`, 'Set-Cookie': cookie('oauth_state', '', url, 0) },
  });

  if (url.searchParams.get('error')) return back('negado');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = getCookie(request, 'oauth_state');
  if (!code || !state || !saved || state !== saved) return back('estado');

  // 1) Troca o código por token e busca o perfil no Discord.
  let me;
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${url.origin}/api/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return back('discord');
    const { access_token } = await tokenRes.json();
    const meRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!meRes.ok) return back('discord');
    me = await meRes.json();
    if (!me.id || !/^\d+$/.test(me.id)) return back('discord');
  } catch (err) {
    console.error('callback (discord):', err);
    return back('discord');
  }

  // 2) Grava usuário e sessão no D1.
  try {
    await env.DB.prepare(
      'INSERT INTO users (id, username, avatar) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar'
    ).bind(me.id, me.global_name || me.username || 'Usuário', me.avatar || null).run();

    const { token, maxAge } = await createSession(env, me.id);
    const headers = new Headers({ Location: '/', 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', cookie('sid', token, url, maxAge));
    headers.append('Set-Cookie', cookie('oauth_state', '', url, 0));
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error('callback (banco):', err);
    return back('servidor');
  }
}
