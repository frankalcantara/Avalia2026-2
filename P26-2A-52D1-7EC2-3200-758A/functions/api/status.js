/**
 * GET /api/status
 * Diagnóstico simples: conexão com o Cloudflare D1 e configuração do Discord OAuth2.
 */
import { CHAVE, json } from "../../lib/servidor.js";

export async function onRequestGet({ env }) {
  let d1Conectado = false;
  let totalTitulos = 0;
  let totalAvaliacoes = 0;
  try {
    const linha = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM titulos) AS titulos, (SELECT COUNT(*) FROM avaliacoes) AS avaliacoes"
    ).first();
    d1Conectado = true;
    totalTitulos = linha.titulos;
    totalAvaliacoes = linha.avaliacoes;
  } catch {}

  return json({
    ok: true,
    chave: CHAVE,
    projeto: "#25 Catálogo de Filmes e Séries com Avaliações da Turma",
    d1Conectado,
    discordConfigurado: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    totalTitulos,
    totalAvaliacoes,
    horario: new Date().toISOString(),
  });
}
