/**
 * POST /api/auth/logout
 * Encerra a sessão no servidor (não apenas o cookie) e devolve o cookie expirado.
 */

import { encerrarSessao } from "../../_lib/sessao.js";
import { json, responderErro, verificarOrigem } from "../../_lib/http.js";

export async function onRequestPost({ request, env }) {
  try {
    verificarOrigem(request);
    const cookie = await encerrarSessao(request, env);
    return json({ ok: true }, { cookies: [cookie] });
  } catch (erro) {
    return responderErro(erro);
  }
}
