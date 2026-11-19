// GET /api/status: diagnóstico público (não exige sessão e nunca expõe segredos).
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { json, methodNotAllowed } from "../_lib/http.js";

export const CHAVE = "P26-2A-0FC2-F5F9-5A1B-0D19";

export async function onRequestGet({ env }) {
  // Testa o D1 com uma consulta trivial; falha não derruba a rota.
  let d1Connected = false;
  try {
    if (env.DB) d1Connected = (await env.DB.prepare("SELECT 1 AS ok").first())?.ok === 1;
  } catch {
    d1Connected = false;
  }
  return json({
    ok: true,
    chave: CHAVE,
    d1Connected,
    // Apenas indica se as variáveis existem; os valores nunca são retornados.
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    serverTimestamp: Date.now(),
  });
}

export const onRequest = () => methodNotAllowed("GET");
