import { expiredCookie, failure, json, sameOrigin, SESSION_COOKIE, STATE_COOKIE } from '../../../lib/auth.js';

export async function onRequest({ request }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  if (!sameOrigin(request)) return failure(403, 'invalid_origin', 'Origem não autorizada.');
  const response = json({ ok: true });
  response.headers.append('Set-Cookie', expiredCookie(SESSION_COOKIE));
  response.headers.append('Set-Cookie', expiredCookie(STATE_COOKIE));
  return response;
}
