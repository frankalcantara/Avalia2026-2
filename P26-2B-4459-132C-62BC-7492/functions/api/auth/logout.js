// POST /api/auth/logout — apaga a sessão no D1 e expira o cookie.
import { COOKIE_SID } from '../../_lib/config.js';
import { destroySession } from '../../_lib/auth.js';
import { handle, isHttps, json, serializeCookie } from '../../_lib/http.js';

export const onRequestPost = handle(
  async ({ request, env }) => {
    await destroySession(request, env);
    return json({ ok: true }, 200, {
      'Set-Cookie': serializeCookie(COOKIE_SID, '', { maxAge: 0, secure: isHttps(request) }),
    });
  },
  { post: true },
);
