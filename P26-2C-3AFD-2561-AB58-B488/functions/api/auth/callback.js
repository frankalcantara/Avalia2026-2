import { cookie, parseCookies, createSessionToken, SESSION_MAX_AGE } from '../../_lib/auth.js';

const fail = (msg) => new Response(null, { status: 302, headers: { Location: `/?erro=${encodeURIComponent(msg)}` } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = parseCookies(request.headers.get('Cookie')).oauth_state;

  if (url.searchParams.get('error')) return fail('Login cancelado no Discord.');
  if (!code || !state || state !== savedState) return fail('Falha de segurança no login. Tente de novo.');

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  if (!tokenRes.ok) return fail('O Discord recusou o código de login.');
  const { access_token } = await tokenRes.json();

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!meRes.ok) return fail('Não foi possível ler seu perfil no Discord.');
  const me = await meRes.json();

  await env.DB.prepare(
    `INSERT INTO users (id, username, avatar) VALUES (?1, ?2, ?3)
     ON CONFLICT(id) DO UPDATE SET username = ?2, avatar = ?3, last_login = datetime('now')`
  ).bind(me.id, me.global_name || me.username, me.avatar ?? null).run();

  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', cookie('session', await createSessionToken(env.SESSION_SECRET, me.id), SESSION_MAX_AGE));
  headers.append('Set-Cookie', cookie('oauth_state', '', 0));
  return new Response(null, { status: 302, headers });
}
