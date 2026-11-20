import { json } from '../../_lib/http.js';
import { destroySession, buildClearCookie } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
  await destroySession(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': buildClearCookie(request) });
}
