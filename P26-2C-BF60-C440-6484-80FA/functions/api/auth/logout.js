// POST /api/auth/logout — apaga a sessão no D1 e expira o cookie.
import { json, route, methodNotAllowed, ensureJsonIfBody } from "../../../src/http.js";
import { sessionToken, clearSessionCookie } from "../../../src/auth.js";

export const onRequestPost = route(async ({ request, env }) => {
  await ensureJsonIfBody(request);
  const token = sessionToken(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
});

// Rota só aceita POST: GET responderia com o HTML estático; devolve 405 JSON.
export const onRequestGet = () => methodNotAllowed();
