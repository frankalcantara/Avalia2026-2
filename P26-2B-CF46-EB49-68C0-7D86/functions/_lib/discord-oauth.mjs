import {
  base64url, opaqueCookie, opaquePattern, randomToken, readOpaqueCookie, sessionCookie, sha256, tokenHash,
} from './session.mjs';

const issuer = 'https://discord.com';
export const loginPath = '/api/auth/discord';
export const callbackPath = loginPath + '/callback';
const attemptCookie = '__Host-p23_oauth';
const attemptSeconds = 10 * 60;
const sessionSeconds = 7 * 24 * 60 * 60;

function configFor(url, env) {
  const clientId = env?.DISCORD_CLIENT_ID;
  const clientSecret = env?.DISCORD_CLIENT_SECRET;
  const redirectUri = env?.DISCORD_REDIRECT_URI;
  if (!env?.DB || url.protocol !== 'https:' || typeof clientId !== 'string' || !/^[1-9]\d{0,19}$/u.test(clientId) ||
      typeof clientSecret !== 'string' || !clientSecret.trim() || redirectUri !== url.origin + callbackPath) return null;
  return { clientId, clientSecret, redirectUri, db: env.DB };
}

function redirect(location, status, cookies = []) {
  const headers = new Headers({
    Location: location,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}

function finish(status = '', cookies = []) {
  return redirect(status ? '/?auth=' + status : '/', 303, cookies);
}

async function login(config) {
  const state = randomToken();
  const browserToken = randomToken();
  const verifier = randomToken();
  const [stateHash, browserHash, challenge] = await Promise.all([
    tokenHash(state), tokenHash(browserToken), sha256(verifier).then(base64url),
  ]);
  await config.db.batch([
    config.db.prepare('DELETE FROM oauth_attempts WHERE expires_at <= unixepoch()'),
    config.db.prepare('INSERT INTO oauth_attempts (state_hash, browser_hash, code_verifier, expires_at) VALUES (?, ?, ?, unixepoch() + ?)')
      .bind(stateHash, browserHash, verifier, attemptSeconds),
  ]);
  const query = new URLSearchParams({
    client_id: config.clientId, response_type: 'code', scope: 'identify', redirect_uri: config.redirectUri,
    state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  return redirect(issuer + '/oauth2/authorize?' + query, 302, [opaqueCookie(attemptCookie, browserToken, attemptSeconds)]);
}

const oauthErrors = new Set([
  'invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client',
  'unsupported_grant_type', 'invalid_scope', 'server_error', 'temporarily_unavailable',
]);

class DiscordOAuthError extends Error {
  constructor(stage, diagnostic = {}) {
    super(stage);
    this.diagnostic = { stage, ...diagnostic };
  }
}

const exceptionNames = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'AbortError',
  'TimeoutError', 'NetworkError', 'SecurityError', 'NotSupportedError',
]);

function discordRequestError(stage, category, failure) {
  const name = failure?.name;
  const exceptionName = exceptionNames.has(name) ? name : 'UnknownError';
  return new DiscordOAuthError(stage, { httpStatus: null, category, exceptionName });
}

async function discordJson(path, makeInit, requestStage, responseStage) {
  let init;
  try {
    // Workers supports manual redirects. A non-2xx response below stops the request.
    init = { ...makeInit(), redirect: 'manual', signal: AbortSignal.timeout(8000) };
  } catch (failure) {
    throw discordRequestError(requestStage, 'preparation', failure);
  }

  let response;
  try {
    response = await fetch(issuer + path, init);
  } catch (failure) {
    throw discordRequestError(requestStage, init.signal.aborted ? 'timeout' : 'fetch', failure);
  }
  if (!response.ok) {
    const diagnostic = { httpStatus: response.status };
    if (requestStage === 'token_exchange' && (response.status < 300 || response.status >= 400)) {
      const payload = await response.json().catch(() => null);
      if (oauthErrors.has(payload?.error)) diagnostic.oauthError = payload.error;
    }
    throw new DiscordOAuthError(requestStage, diagnostic);
  }
  try {
    return await response.json();
  } catch {
    throw new DiscordOAuthError(responseStage);
  }
}

function profileFrom(data) {
  const id = data?.id;
  const username = data?.username;
  const displayName = data?.global_name || username;
  const validName = value => typeof value === 'string' && value.trim() && value.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(value);
  if (typeof id !== 'string' || !/^[1-9]\d{0,19}$/u.test(id) || !validName(username) || !validName(displayName)) {
    throw new DiscordOAuthError('profile_response');
  }

  const cdn = 'https://cdn.discordapp.com';
  let avatar;
  if (typeof data.avatar === 'string' && /^(?:a_)?[a-f0-9]{32}$/u.test(data.avatar)) {
    avatar = cdn + '/avatars/' + id + '/' + data.avatar + '.webp?size=128';
  } else {
    const discriminator = data.discriminator;
    const index = typeof discriminator === 'string' && /^[0-9]{4}$/u.test(discriminator)
      ? Number(discriminator) % 5 : Number((BigInt(id) >> 22n) % 6n);
    avatar = cdn + '/embed/avatars/' + index + '.png';
  }
  return { id, username: username.trim(), displayName: displayName.trim(), avatar };
}

async function fetchProfile(config, code, verifier) {
  const token = await discordJson('/api/oauth2/token', () => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'authorization_code',
      redirect_uri: config.redirectUri, code, code_verifier: verifier,
    }),
  }), 'token_exchange', 'token_response');
  if (typeof token?.access_token !== 'string' || !/^[A-Za-z0-9._~+/=-]{1,2048}$/u.test(token.access_token) ||
      typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer' ||
      typeof token.scope !== 'string' || !token.scope.split(/\s+/u).includes('identify')) throw new DiscordOAuthError('token_response');

  return profileFrom(await discordJson('/api/v10/users/@me', () => ({
    headers: { Authorization: 'Bearer ' + token.access_token },
  }), 'profile_request', 'profile_response'));
}

async function createSession(db, profile, request) {
  const token = randomToken();
  const hash = await tokenHash(token);
  const statements = [
    db.prepare(
      'INSERT INTO users (id, discord_id, discord_username, display_name, avatar_url) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT (discord_id) DO UPDATE SET discord_username = excluded.discord_username, ' +
      'display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = unixepoch()'
    ).bind(crypto.randomUUID(), profile.id, profile.username, profile.displayName, profile.avatar),
    db.prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at) SELECT ?, id, unixepoch() + ? FROM users WHERE discord_id = ?'
    ).bind(hash, sessionSeconds, profile.id),
  ];
  const previousToken = readOpaqueCookie(request, sessionCookie);
  if (previousToken) {
    statements.push(db.prepare(
      'UPDATE sessions SET revoked_at = unixepoch() WHERE token_hash = ? AND revoked_at IS NULL ' +
      'AND EXISTS (SELECT 1 FROM sessions WHERE token_hash = ?)'
    ).bind(await tokenHash(previousToken), hash));
  }
  const results = await db.batch(statements);
  const sessionWrite = results[1];
  if (!sessionWrite?.success || Number(sessionWrite.meta?.changes) !== 1) {
    throw new DiscordOAuthError('session_write');
  }
  return opaqueCookie(sessionCookie, token, sessionSeconds);
}

async function callback(request, url, config) {
  const query = url.searchParams;
  const [state] = query.getAll('state');
  const [code] = query.getAll('code');
  const [error] = query.getAll('error');
  const [responseIssuer] = query.getAll('iss');
  const browserToken = readOpaqueCookie(request, attemptCookie);
  if (!opaquePattern.test(state || '') || !browserToken ||
      ['state', 'code', 'error', 'iss'].some(key => query.getAll(key).length > 1) ||
      (query.has('iss') && responseIssuer !== issuer)) return finish('invalid');

  const [stateHash, browserHash] = await Promise.all([tokenHash(state), tokenHash(browserToken)]);
  // This statement checks the browser binding, expiration and one-time use together.
  const attempt = await config.db.prepare(
    'DELETE FROM oauth_attempts WHERE state_hash = ? AND browser_hash = ? AND expires_at > unixepoch() RETURNING code_verifier'
  ).bind(stateHash, browserHash).first();
  if (!attempt) return finish('invalid');

  const cookies = [opaqueCookie(attemptCookie, '', 0)];
  if (error === 'access_denied' && !query.has('code')) return finish('cancelled', cookies);
  if (!code || code.length > 2048 || query.has('error')) return finish('invalid', cookies);
  try {
    const profile = await fetchProfile(config, code, attempt.code_verifier);
    cookies.push(await createSession(config.db, profile, request));
    return finish('', cookies);
  } catch (failure) {
    // Keep request data, provider bodies and raw exceptions out of the logs.
    const diagnostic = failure instanceof DiscordOAuthError ? failure.diagnostic : { stage: 'session_write' };
    console.warn('discord_oauth_callback_failed', diagnostic);
    return finish('failed', cookies);
  }
}

export async function discordOAuth(request, url, env, path) {
  const config = configFor(url, env);
  if (!config) return finish('unavailable');
  try {
    return path === loginPath ? await login(config) : await callback(request, url, config);
  } catch {
    return finish('unavailable');
  }
}
