// GET /api/auth/callback — conclui o OAuth2: valida state, troca code, importa user_id/nome/avatar.
import { COOKIE_SID, COOKIE_STATE, SESSION_TTL_MS } from '../../_lib/config.js';
import { createSession, timingSafeEqual } from '../../_lib/auth.js';
import { handle, isHttps, parseCookies, redirect, serializeCookie } from '../../_lib/http.js';

const USER_AGENT = 'quiz-competitivo-p26-2b (P26-2B-4459-132C-62BC-7492)';

export const onRequestGet = handle(async ({ request, env }) => {
  const url = new URL(request.url);
  const secure = isHttps(request);
  const clearState = serializeCookie(COOKIE_STATE, '', { maxAge: 0, secure }); // o state vale uma única vez
  const bad = (code) => redirect(`/?erro=${code}`, [clearState]);

  if (url.searchParams.get('error')) return bad('negado');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = parseCookies(request)[COOKIE_STATE];
  if (!code || !state || !cookieState || !timingSafeEqual(state, cookieState)) return bad('state');
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return bad('config');

  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  let me;
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return bad('token');
    const { access_token: accessToken } = await tokenRes.json();
    if (!accessToken) return bad('token');

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${accessToken}`, 'user-agent': USER_AGENT },
    });
    if (!meRes.ok) return bad('perfil');
    me = await meRes.json();
  } catch (e) {
    console.error('falha no OAuth2 do Discord:', e);
    return bad('discord');
  }

  if (!me || !/^\d{5,25}$/.test(String(me.id))) return bad('perfil');
  const userId = String(me.id);
  const name = String(me.global_name || me.username || 'Jogador').slice(0, 64);
  const avatar = typeof me.avatar === 'string' && /^[a-z0-9_]{1,64}$/i.test(me.avatar) ? me.avatar : null;
  const now = Date.now();

  await env.DB
    .prepare(
      'INSERT INTO users (id, name, avatar, created_at, last_login_at) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, last_login_at = excluded.last_login_at',
    )
    .bind(userId, name, avatar, now, now)
    .run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run(); // limpeza oportunista

  const token = await createSession(env.DB, userId, now);
  return redirect('/', [
    serializeCookie(COOKIE_SID, token, { maxAge: Math.floor(SESSION_TTL_MS / 1000), secure }),
    clearState,
  ]);
});
