// Sessão stateless: cookie assinado com HMAC-SHA256 (Web Crypto, funciona em Workers e Node).

export const SESSION_COOKIE = 'session';
export const STATE_COOKIE = 'oauth_state';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function hmacKey(secret, usage) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function createSession(secret, userId, ttlSeconds = SESSION_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = toB64Url(enc.encode(JSON.stringify({ uid: userId, exp })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(payload)));
  return `${payload}.${toB64Url(sig)}`;
}

/** Retorna { uid, exp } se o token for autêntico e não expirado; senão null. */
export async function readSession(secret, token) {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret, 'verify'),
      fromB64Url(parts[1]),
      enc.encode(parts[0]),
    );
    if (!ok) return null;
    const data = JSON.parse(dec.decode(fromB64Url(parts[0])));
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number') return null;
    if (data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24) {
  return toB64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure = true } = {}) {
  let c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
  return c;
}
