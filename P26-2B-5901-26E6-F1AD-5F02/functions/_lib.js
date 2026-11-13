// Utilitários compartilhados (não exporta onRequest, logo não vira rota).
export const DAY = 86400;
export const now = () => Math.floor(Date.now() / 1000);
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export function getCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function getUser({ request, env }) {
  const token = getCookie(request, 'session');
  if (!token) return null;
  return await env.DB.prepare(
    `SELECT u.id, u.name, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`).bind(token, now()).first();
}
export const unauthorized = () => json({ error: 'Não autenticado' }, 401);
export const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** SM-2 simplificado. rating: 'dificil' | 'bom' | 'facil'. */
export function sm2(card, rating) {
  let { ease, interval_days: iv, repetitions: reps } = card;
  if (rating === 'dificil') {
    iv = 1; reps = 0; ease = Math.max(1.3, ease - 0.2);
  } else if (rating === 'bom') {
    iv = reps === 0 ? 3 : Math.max(iv + 1, Math.round(iv * ease)); reps += 1;
  } else if (rating === 'facil') {
    iv = reps === 0 ? 4 : Math.max(iv + 2, Math.round(iv * ease * 1.3)); reps += 1; ease += 0.15;
  } else throw new Error('rating inválido');
  ease = Math.round(ease * 100) / 100;
  return { ease, interval_days: iv, repetitions: reps };
}
