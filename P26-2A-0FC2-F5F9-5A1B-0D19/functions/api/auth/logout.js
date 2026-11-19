// POST /api/auth/logout: apaga a sessão no D1 e expira o cookie.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { checkPost, json, methodNotAllowed, safe } from "../../_lib/http.js";
import { clearCookie, destroySession, SESSION_COOKIE } from "../../_lib/session.js";

export const onRequestPost = safe(async ({ request, env }) => {
  // Anti-CSRF: JSON obrigatório e Origin igual à origem.
  const bad = checkPost(request);
  if (bad) return bad;
  await destroySession(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
});

export const onRequest = () => methodNotAllowed("POST");
