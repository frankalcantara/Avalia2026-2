/**
 * POST /api/auth/logout — apaga a sessão no D1 e expira o cookie. Sempre 200 { ok: true }.
 * (CSRF/Origin verificado no middleware.)
 */
import { json, porMetodo } from "../../_lib/http.js";
import { COOKIE_SESSAO, apagarSessaoAtual, cookieExpirado } from "../../_lib/sessao.js";

export const onRequest = porMetodo({
  POST: async ({ request, env }) => {
    await apagarSessaoAtual(env, request);
    return json({ ok: true }, 200, { "Set-Cookie": cookieExpirado(COOKIE_SESSAO) });
  },
});
