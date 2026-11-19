// Sessões e identidade do usuário (token aleatório no cookie; só o hash fica no D1).
import { COOKIE_SID, SESSION_TTL_MS } from './config.js';
import { HttpError, parseCookies } from './http.js';

const encoder = new TextEncoder();

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Inteiro uniforme em [0, n) sem viés de módulo. */
export function randomInt(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % n;
}

export function shuffle(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function avatarUrl(id, avatar) {
  if (avatar && /^[a-z0-9_]{1,64}$/i.test(avatar) && /^\d{5,25}$/.test(id)) {
    const ext = avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
  }
  let index = 0;
  try {
    index = Number((BigInt(id) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export async function createSession(db, userId, now = Date.now()) {
  const token = randomToken(32);
  const hash = await sha256Hex(token);
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(hash, userId, now, now + SESSION_TTL_MS)
    .run();
  return token;
}

export async function getUser(request, env, now = Date.now()) {
  const token = parseCookies(request)[COOKIE_SID];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB
    .prepare('SELECT u.id, u.name, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(hash, now)
    .first();
  return row ? { id: row.id, name: row.name, avatar: row.avatar } : null;
}

export async function requireUser(request, env) {
  const user = await getUser(request, env);
  if (!user) throw new HttpError(401, 'unauthenticated', 'Faça login com o Discord.');
  return user;
}

export async function destroySession(request, env) {
  const token = parseCookies(request)[COOKIE_SID];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
}
