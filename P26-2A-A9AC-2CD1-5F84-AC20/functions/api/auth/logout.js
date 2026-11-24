import { json, cookie, destroySession, fail } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return fail(403, 'Origem não permitida.');
  await destroySession(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('sid', '', new URL(request.url), 0) });
}
