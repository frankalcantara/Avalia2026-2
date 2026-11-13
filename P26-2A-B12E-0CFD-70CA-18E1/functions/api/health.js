/**
 * GET /api/health
 * Sonda pública usada pelo deploy e pela validação: confirma Function + D1.
 */

import { json, responderErro } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  try {
    const linha = await env.DB.prepare("SELECT 1 AS ok").first();
    return json({
      ok: linha?.ok === 1,
      servico: "sorteador-auditavel",
      chave: "P26-2A-B12E-0CFD-70CA-18E1",
      banco: linha?.ok === 1 ? "ok" : "indisponivel",
      discordConfigurado: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      agora: new Date().toISOString(),
    });
  } catch (erro) {
    return responderErro(erro);
  }
}
