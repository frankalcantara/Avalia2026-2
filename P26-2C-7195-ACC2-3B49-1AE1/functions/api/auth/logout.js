import { fail, isSameOrigin, json } from '../../../lib/http.js';
import { serializeCookie, SESSION_COOKIE } from '../../../lib/session.js';

// POST /api/auth/logout — encerra a sessão (apaga o cookie).
export async function onRequestPost({ request }) {
  if (!isSameOrigin(request)) return fail(403, 'Origem da requisição não permitida.', 'forbidden_origin');
  const secure = new URL(request.url).protocol === 'https:';
  const headers = new Headers({ 'Set-Cookie': serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure }) });
  return json({ ok: true }, 200, headers);
}
