import { cookie, json } from '../../_lib/auth.js';

export async function onRequestPost({ request }) {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return json({ error: 'Origem não permitida.' }, 403);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie('session', '', 0) },
  });
}
