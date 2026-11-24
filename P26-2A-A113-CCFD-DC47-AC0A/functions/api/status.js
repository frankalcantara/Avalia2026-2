/**
 * /api/status — verificação de saúde (D1 e configuração do OAuth). Somente leitura.
 */
import { json } from "../_lib/util.js";

export async function onRequestGet({ env }) {
  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      d1Connected = true;
    } catch {}
  }
  return json({
    ok: true,
    chave: "P26-2A-A113-CCFD-DC47-AC0A",
    projectId: 7,
    projectTitle: "Jogo da Memória Temático",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.SESSION_SECRET),
    serverTimestamp: new Date().toISOString(),
  });
}
