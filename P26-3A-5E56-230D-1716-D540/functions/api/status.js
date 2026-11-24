/**
 * GET /api/status — saúde do serviço (público).
 * 200 { ok, d1, oauth_configurado, chave }  |  503 com o mesmo corpo se o D1 falhar.
 * d1 = true só se o D1 responde E as 4 tabelas do contrato existem.
 * oauth_configurado = DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET definidos (e o ID não é o placeholder).
 */
import { json, porMetodo } from "../_lib/http.js";
import { oauthConfigurado } from "../_lib/discord.js";

const CHAVE = "P26-3A-5E56-230D-1716-D540";
const TABELAS = ["usuarios", "sessoes", "itens", "reivindicacoes"];

async function verificarD1(env) {
  if (!env.DB) return false;
  try {
    const linha = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?)`,
    )
      .bind(...TABELAS)
      .first();
    return Number(linha && linha.n) === TABELAS.length;
  } catch (e) {
    console.error(JSON.stringify({ nivel: "erro", evento: "status_d1", erro: String(e && e.message) }));
    return false;
  }
}

export const onRequest = porMetodo({
  GET: async ({ env }) => {
    const d1 = await verificarD1(env);
    const corpo = { ok: d1, d1, oauth_configurado: oauthConfigurado(env), chave: CHAVE };
    return json(corpo, d1 ? 200 : 503);
  },
});
