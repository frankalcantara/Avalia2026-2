import { buildCookie, getCookie, getSessionSecret, signSession } from '../../../lib/session.js';

function redirectWithError(origin, code, clearStateCookie) {
  const headers = new Headers({
    Location: `${origin}/?auth_error=${encodeURIComponent(code)}`,
  });
  if (clearStateCookie) {
    headers.append('Set-Cookie', clearStateCookie);
  }
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const isHttps = url.protocol === 'https:';
  const clearStateCookie = buildCookie('oauth_state', '', { maxAge: 0, isHttps });

  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    return redirectWithError(url.origin, errorParam, clearStateCookie);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return redirectWithError(url.origin, 'missing_code', clearStateCookie);
  }

  const stateParam = url.searchParams.get('state');
  const expectedState = getCookie(request, 'oauth_state');
  if (expectedState && stateParam !== expectedState) {
    return redirectWithError(url.origin, 'invalid_state', clearStateCookie);
  }

  const clientId = (env.DISCORD_CLIENT_ID || '').trim();
  const clientSecret = (env.DISCORD_CLIENT_SECRET || '').trim();
  const redirectUri = (env.DISCORD_REDIRECT_URI || new URL('/api/auth/callback', url.origin).href).trim();

  if (!clientId || !clientSecret) {
    return new Response(
      'Variáveis DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET não configuradas.',
      { status: 500 }
    );
  }

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DiarioDeBordo-F26 (https://github.com/frankalcantara/Avalia2026-2, 1.0)',
      },
      body: body.toString(),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      return redirectWithError(url.origin, 'token_exchange_failed', clearStateCookie);
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'DiarioDeBordo-F26 (https://github.com/frankalcantara/Avalia2026-2, 1.0)',
      },
    });

    const user = await userRes.json().catch(() => ({}));
    if (!userRes.ok || !user.id) {
      return redirectWithError(url.origin, 'fetch_user_failed', clearStateCookie);
    }

    const secret = getSessionSecret(env);
    const sessionToken = await signSession(
      {
        user_id: user.id,
        username: user.global_name || user.username,
        avatar: user.avatar || null,
      },
      secret,
      86400
    );

    const headers = new Headers({
      Location: '/',
    });
    headers.append('Set-Cookie', buildCookie('session', sessionToken, { maxAge: 86400, isHttps }));
    headers.append('Set-Cookie', clearStateCookie);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch {
    return redirectWithError(url.origin, 'callback_exception', clearStateCookie);
  }
}
