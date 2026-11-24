const encoder = new TextEncoder();
export const SESSION_COOKIE = '__Host-discord_session';
export const STATE_COOKIE = '__Host-discord_state';
export const SESSION_SECONDS = 60 * 60 * 8;
const STATE_SECONDS = 60 * 10;

export function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } });
}
export function failure(status, error, message) { return json({ ok: false, error, message }, status); }
export function configured(env) {
  return typeof env.DISCORD_CLIENT_ID === 'string' && /^\d+$/.test(env.DISCORD_CLIENT_ID)
    && typeof env.DISCORD_CLIENT_SECRET === 'string' && env.DISCORD_CLIENT_SECRET.length > 0
    && typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode64(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), c => c.charCodeAt(0));
}
async function key(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Session secret unavailable');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signPayload(payload, secret) {
  const encoded = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(encoded));
  return `${encoded}.${base64url(new Uint8Array(signature))}`;
}
export async function verifyPayload(token, secret, purpose) {
  try {
    if (!token || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    if (!await crypto.subtle.verify('HMAC', await key(secret), decode64(parts[1]), encoder.encode(parts[0]))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode64(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== purpose || !Number.isInteger(payload.exp) || payload.exp <= now
      || !Number.isInteger(payload.iat) || payload.iat > now + 30 || payload.exp <= payload.iat
      || payload.exp - payload.iat > (purpose === 'state' ? STATE_SECONDS : SESSION_SECONDS)) return null;
    return payload;
  } catch { return null; }
}
export function readCookie(request, name) {
  const values = (request.headers.get('Cookie') || '').split(';').map(c => c.trim()).filter(c => c.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}
export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function expiredCookie(name) { return cookie(name, '', 0); }
export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
export async function getSession(request, env) {
  const payload = await verifyPayload(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET, 'session');
  if (!payload || !/^\d{1,30}$/.test(payload.user_id) || typeof payload.username !== 'string'
    || !payload.username || payload.username.length > 100 || typeof payload.avatar !== 'string'
    || !payload.avatar.startsWith('https://cdn.discordapp.com/')) return null;
  return { user_id: payload.user_id, username: payload.username, avatar: payload.avatar };
}
export async function createSession(user, secret) {
  const iat = Math.floor(Date.now() / 1000);
  return signPayload({ ...user, purpose: 'session', iat, exp: iat + SESSION_SECONDS }, secret);
}
export async function createState(secret) {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const iat = Math.floor(Date.now() / 1000);
  return { nonce, token: await signPayload({ purpose: 'state', nonce, iat, exp: iat + STATE_SECONDS }, secret) };
}
export function stateCookie(token) { return cookie(STATE_COOKIE, token, STATE_SECONDS); }
export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 302, headers });
}
