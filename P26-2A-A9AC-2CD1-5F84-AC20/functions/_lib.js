// Utilitários compartilhados pelas Pages Functions (sessão, validação, respostas JSON).

export const CATEGORIES = {
  receita: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
  despesa: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Outros'],
};
export const ALL_CATEGORIES = [...new Set([...CATEGORIES.receita, ...CATEGORIES.despesa])];

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const nowSec = () => Math.floor(Date.now() / 1000);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
export const fail = (status, error) => json({ error }, status);

export function getCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function cookie(name, value, url, maxAge) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async (text) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));

export async function createSession(env, userId) {
  const token = randomToken();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowSec()).run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, nowSec() + SESSION_SECONDS).run();
  return { token, maxAge: SESSION_SECONDS };
}

export async function destroySession(request, env) {
  const token = getCookie(request, 'sid');
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

// Retorna { user } ou { response } (erro pronto para devolver). Mutações exigem mesma origem.
export async function requireUser(request, env, mutating = false) {
  if (mutating) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return { response: fail(403, 'Origem não permitida.') };
  }
  const token = getCookie(request, 'sid');
  if (!token) return { response: fail(401, 'Faça login para continuar.') };
  const user = await env.DB.prepare(
    'SELECT u.id, u.username, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(await sha256(token), nowSec()).first();
  if (!user) return { response: fail(401, 'Sessão expirada. Entre novamente.') };
  return { user };
}

export function avatarUrl(user) {
  if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

// Aceita "1234,56", "1234.56" e "1.234,56". Retorna centavos (inteiro) ou null.
export function parseAmountToCents(value) {
  const s = String(value ?? '').trim();
  let norm;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) norm = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+([.,]\d{1,2})?$/.test(s)) norm = s.replace(',', '.');
  else return null;
  const [int, dec = ''] = norm.split('.');
  const cents = parseInt(int, 10) * 100 + parseInt((dec + '00').slice(0, 2), 10);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 99999999999 ? cents : null;
}

export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= '2000-01-01' && s <= '2100-12-31';
}

export function validateTransaction(body) {
  const bad = (error) => ({ error });
  if (!body || typeof body !== 'object') return bad('Dados inválidos.');
  const { type, category, date } = body;
  if (type !== 'receita' && type !== 'despesa') return bad('Escolha receita ou despesa.');
  const amount_cents = parseAmountToCents(body.amount);
  if (!amount_cents) return bad('Informe um valor maior que zero, como 25,90.');
  if (!CATEGORIES[type].includes(category)) return bad('Escolha uma categoria válida.');
  if (!validDate(date)) return bad('Informe uma data válida.');
  const description = body.description == null ? '' : body.description;
  if (typeof description !== 'string' || description.trim().length > 80) return bad('A descrição pode ter até 80 caracteres.');
  return { value: { type, amount_cents, category, date, description: description.trim() } };
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
