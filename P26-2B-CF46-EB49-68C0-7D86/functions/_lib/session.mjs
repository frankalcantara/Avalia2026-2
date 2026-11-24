export const sessionCookie = '__Host-p23_session';
export const opaquePattern = /^[A-Za-z0-9_-]{43}$/u;

export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

export async function tokenHash(value) {
  return Array.from(await sha256(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function readOpaqueCookie(request, name) {
  const prefix = name + '=';
  const cookies = (request.headers.get('Cookie') || '').split(';').map(cookie => cookie.trim());
  const matches = cookies.filter(cookie => cookie.startsWith(prefix));
  const token = matches.length === 1 ? matches[0].slice(prefix.length) : '';
  return opaquePattern.test(token) ? token : '';
}

export function opaqueCookie(name, value, maxAge) {
  return name + '=' + value + '; Path=/; Max-Age=' + maxAge + '; HttpOnly; Secure; SameSite=Lax';
}

export async function sessionFor(request, db) {
  const token = readOpaqueCookie(request, sessionCookie);
  if (!token) return null;
  const hash = await tokenHash(token);
  const row = await db.prepare(
    'SELECT u.id, u.display_name, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id ' +
    'WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > unixepoch()'
  ).bind(hash).first();
  return row ? { user: { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url }, hash } : null;
}
