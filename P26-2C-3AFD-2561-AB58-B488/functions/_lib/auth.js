// Sessão por cookie assinado (HMAC-SHA256). Sem dependências externas.
const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 dias

const b64u = {
  enc: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (str) => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
};

async function sign(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u.enc(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret, uid, now = Date.now()) {
  const payload = b64u.enc(enc.encode(JSON.stringify({ uid, exp: Math.floor(now / 1000) + SESSION_TTL })));
  return `${payload}.${await sign(secret, payload)}`;
}

export async function readSessionToken(secret, token, now = Date.now()) {
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!safeEqual(sig, await sign(secret, payload))) return null;
  try {
    const data = JSON.parse(dec.decode(b64u.dec(payload)));
    if (!data.uid || data.exp < Math.floor(now / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export const SESSION_MAX_AGE = SESSION_TTL;

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// Retorna { user } ou { response } (401 / 403). Em escritas, confere a Origin (anti-CSRF).
export async function requireUser({ request, env }, { write = false } = {}) {
  if (write) {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(request.url).origin) {
      return { response: json({ error: 'Origem não permitida.' }, 403) };
    }
  }
  const token = parseCookies(request.headers.get('Cookie')).session;
  const session = await readSessionToken(env.SESSION_SECRET, token);
  if (!session) return { response: json({ error: 'Não autenticado.' }, 401) };
  const user = await env.DB.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(session.uid).first();
  if (!user) return { response: json({ error: 'Não autenticado.' }, 401) };
  return { user };
}

export const serializeQuote = (row, viewerId) => ({
  id: row.id,
  text: row.text,
  author: row.author,
  work: row.work,
  page: row.page,
  theme: row.theme || '',
  notes: row.notes || '',
  is_public: row.is_public === 1,
  created_at: row.created_at,
  owner: { id: row.user_id, username: row.username, avatar: row.avatar },
  mine: row.user_id === viewerId,
});
