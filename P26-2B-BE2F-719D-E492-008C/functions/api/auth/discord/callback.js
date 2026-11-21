import { assinar, lerCookie } from '../../../_lib/sessao.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const erroPara = (e) => Response.redirect(new URL('/?auth_error=' + e, url.origin).href, 302);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error') || !code) return erroPara('missing_code');
  if (!state || state !== lerCookie(request, 'oauth_state')) return erroPara('invalid_state');
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return Response.json({ erro: 'variáveis de ambiente ausentes' }, { status: 500 });
  }

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
    if (!tokenRes.ok) return erroPara('token_exchange_failed');
    const { access_token } = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return erroPara('fetch_user_failed');
    const u = await userRes.json();

    const nome = u.global_name || u.username;
    const avatar = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';

    await env.DB.prepare(
      `INSERT INTO jogadores (discord_id, username, avatar) VALUES (?, ?, ?)
       ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar`
    ).bind(u.id, nome, avatar).run();

    const token = await assinar({ id: u.id, nome, avatar, exp: Date.now() + 86400000 }, env.SESSION_SECRET);
    const headers = new Headers({ Location: '/?login=success' });
    headers.append('Set-Cookie', `sessao=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0');
    return new Response(null, { status: 302, headers });
  } catch {
    return erroPara('exception');
  }
}