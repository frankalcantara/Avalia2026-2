import { withSchema } from '../../../../lib/schema.js';
import { configured, createSession, cookie, expiredCookie, readCookie, redirect, SESSION_COOKIE, SESSION_SECONDS, STATE_COOKIE, verifyPayload } from '../../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clearState = expiredCookie(STATE_COOKIE);
  const fail = code => redirect(`/?auth_error=${code}`, [clearState]);
  if (!configured(env)) return fail('auth_not_configured');
  const state = await verifyPayload(readCookie(request, STATE_COOKIE), env.SESSION_SECRET, 'state');
  if (!state || !url.searchParams.get('state') || state.nonce !== url.searchParams.get('state')) return fail('invalid_state');
  if (url.searchParams.has('error')) return fail('access_denied');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) return fail('missing_code');
  if (!env.DB) return fail('database_unavailable');
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code', code, redirect_uri: new URL('/api/auth/discord/callback', url.origin).href }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return fail('token_exchange_failed');
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string' || !token.access_token) return fail('token_exchange_failed');
    const profileResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) return fail('fetch_user_failed');
    const profile = await profileResponse.json();
    if (typeof profile.id !== 'string' || !/^\d{1,30}$/.test(profile.id)
      || typeof profile.username !== 'string' || !profile.username) return fail('invalid_profile');
    const username = profile.username;
    if (typeof username !== 'string' || !username || username.length > 100) return fail('invalid_profile');
    const avatar = typeof profile.avatar === 'string' && /^(a_)?[a-fA-F0-9]+$/.test(profile.avatar)
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const user = { user_id: profile.id, username, avatar };
    const saved = await withSchema(env.DB, () => env.DB.prepare('INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP')
      .bind(user.user_id, user.username, user.avatar).run());
    if (saved.success === false) return fail('database_unavailable');
    return redirect('/?login=success', [clearState, cookie(SESSION_COOKIE, await createSession(user, env.SESSION_SECRET), SESSION_SECONDS)]);
  } catch { return fail('login_failed'); }
}
