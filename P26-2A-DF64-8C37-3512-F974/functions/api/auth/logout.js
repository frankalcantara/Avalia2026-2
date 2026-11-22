// POST /api/auth/logout — encerra a sessão no D1 e apaga o cookie.
import { json } from '../../_lib/http.js';
import { destroySession } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
  const cookie = await destroySession(env.DB, request);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
