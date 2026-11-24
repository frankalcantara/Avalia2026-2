/**
 * GET /api/me
 * Identidade atual (ou `autenticado: false`) e se o OAuth está configurado.
 */

import { sessaoAtual } from "../_lib/sessao.js";
import { json, responderErro } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const sessao = await sessaoAtual(request, env);
    return json({
      ok: true,
      autenticado: Boolean(sessao),
      usuario: sessao?.user ?? null,
      discordConfigurado: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    });
  } catch (erro) {
    return responderErro(erro);
  }
}
