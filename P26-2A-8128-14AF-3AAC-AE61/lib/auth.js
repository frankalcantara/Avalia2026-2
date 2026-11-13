import { HttpError, json } from './http.js';

export const SESSION_COOKIE = 'el_session';
const STATE_COOKIE = 'el_oauth_state';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const STATE_SECONDS = 10 * 60;
export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function cookieValue(request, name) {
  const parts = (request.headers.get('Cookie') || '').split(';');
  return parts.map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export function cookie(request, name, value, seconds) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
}

export async function currentUser(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare(`SELECT u.user_id,u.username,u.display_name,u.avatar
    FROM sessions s JOIN users u ON u.user_id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`).bind(await hashToken(token), nowSeconds()).first();
}

export async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, 'Entre com sua conta do Discord para continuar.');
  return user;
}

function credentials(env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new HttpError(503, 'O login Discord ainda não foi configurado pelo responsável pelo site.');
  }
}

export async function startDiscord(request, env) {
  credentials(env);
  const state = randomToken();
  const oldState = cookieValue(request, STATE_COOKIE);
  const statements = [
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<=?').bind(nowSeconds()),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(nowSeconds()),
    env.DB.prepare('INSERT INTO oauth_states(state_hash,expires_at) VALUES(?,?)')
      .bind(await hashToken(state), nowSeconds() + STATE_SECONDS),
  ];
  if (/^[a-f0-9]{64}$/.test(oldState)) {
    statements.push(env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=?').bind(await hashToken(oldState)));
  }
  await env.DB.batch(statements);
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', new URL('/api/auth/discord/callback', request.url).href);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  return new Response(null, { status: 302, headers: {
    Location: url.href,
    'Set-Cookie': cookie(request, STATE_COOKIE, state, STATE_SECONDS),
  } });
}

function callbackRedirect(request, error) {
  return new Response(null, { status: 302, headers: {
    Location: error ? `/?auth_error=${error}` : '/?login=success',
    'Set-Cookie': cookie(request, STATE_COOKIE, '', 0),
  } });
}

export async function finishDiscord(request, env) {
  credentials(env);
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const expected = cookieValue(request, STATE_COOKIE);
  if (!/^[a-f0-9]{64}$/.test(state) || state !== expected) {
    return callbackRedirect(request, 'invalid_state');
  }
  // DELETE RETURNING consome o state atomicamente antes de chamadas externas.
  const consumed = await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND expires_at>? RETURNING state_hash')
    .bind(await hashToken(state), nowSeconds()).first();
  if (!consumed) return callbackRedirect(request, 'expired_state');
  if (url.searchParams.has('error')) return callbackRedirect(request, 'access_denied');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) return callbackRedirect(request, 'missing_code');
  let profile;
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code', code,
        redirect_uri: new URL('/api/auth/discord/callback', request.url).href,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return callbackRedirect(request, 'token_exchange_failed');
    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
      return callbackRedirect(request, 'token_exchange_failed');
    }
    const profileResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) return callbackRedirect(request, 'fetch_user_failed');
    profile = await profileResponse.json();
  } catch {
    return callbackRedirect(request, 'discord_unavailable');
  }
  if (!/^[0-9]{17,20}$/.test(profile.id) || typeof profile.username !== 'string' || !profile.username || profile.username.length > 64) {
    return callbackRedirect(request, 'invalid_profile');
  }
  const avatar = typeof profile.avatar === 'string' && /^(a_)?[a-f0-9]{32}$/.test(profile.avatar)
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(profile.id) >> 22n) % 6n)}.png`;
  const displayName = typeof profile.global_name === 'string' && profile.global_name.trim()
    ? profile.global_name.slice(0, 80) : profile.username;
  const session = randomToken();
  const oldSession = cookieValue(request, SESSION_COOKIE);
  const statements = [
    env.DB.prepare(`INSERT INTO users(user_id,username,display_name,avatar) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,display_name=excluded.display_name,
      avatar=excluded.avatar,updated_at=CURRENT_TIMESTAMP`).bind(profile.id, profile.username, displayName, avatar),
    env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .bind(await hashToken(session), profile.id, nowSeconds() + SESSION_SECONDS),
  ];
  if (/^[a-f0-9]{64}$/.test(oldSession)) {
    statements.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashToken(oldSession)));
  }
  await env.DB.batch(statements);
  const response = callbackRedirect(request);
  response.headers.append('Set-Cookie', cookie(request, SESSION_COOKIE, session, SESSION_SECONDS));
  return response;
}

export async function logout(request, env) {
  await requireUser(request, env);
  const token = cookieValue(request, SESSION_COOKIE);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashToken(token)).run();
  const response = json({ ok: true });
  response.headers.set('Set-Cookie', cookie(request, SESSION_COOKIE, '', 0));
  return response;
}
