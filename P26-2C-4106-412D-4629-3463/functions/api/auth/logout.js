import { lerCookies, sha256Hex, cookieSessaoLimpo, verificarOrigem, json } from '../../_lib/util.js';

export async function onRequestPost({ request, env }) {
  const e = verificarOrigem(request);
  if (e) return e;
  const token = lerCookies(request)['__Host-session'];
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieSessaoLimpo() });
}
