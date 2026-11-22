// Sessões opacas do lado do servidor, persistidas no D1.
import { parseCookies, serializeCookie } from './http.js';

// Prefixo __Host-: exige Secure + Path=/ e proíbe Domain (subdomínios não sobrescrevem).
export const SESSION_COOKIE = '__Host-sid';
export const SESSION_DAYS = 30;

export function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante para strings de mesmo tamanho. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(db, userId) {
  const token = randomToken(32);
  const now = Date.now();
  const maxAge = SESSION_DAYS * 86400;
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    db
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(token), userId, now, now + maxAge * 1000),
  ]);
  return serializeCookie(SESSION_COOKIE, token, { maxAge });
}

export async function getSessionUser(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || token.length > 128) return null;
  return db
    .prepare(
      `SELECT u.id, u.username, u.global_name, u.avatar, u.timezone, u.tz_updated_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(await sha256Hex(token), Date.now())
    .first();
}

export async function destroySession(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token && token.length <= 128) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  }
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0 });
}

export function avatarUrl(user) {
  if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  let index = 0;
  try {
    index = Number((BigInt(user.id) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
