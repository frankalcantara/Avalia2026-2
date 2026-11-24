/**
 * Cloudflare Pages Function — /api/auth/logout
 *
 * Encerra a sessão local apagando o cookie assinado "discord_session".
 * Aceita apenas POST; os demais métodos respondem 405.
 */

import { erroMetodoNaoPermitido, json } from "../_lib/kanban.js";
import { limparCookieSessao } from "../_lib/session.js";

export function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return erroMetodoNaoPermitido();
  }

  const resposta = json({ ok: true }, 200);
  resposta.headers.append("Set-Cookie", limparCookieSessao());
  return resposta;
}
