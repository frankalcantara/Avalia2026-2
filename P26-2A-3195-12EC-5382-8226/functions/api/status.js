/**
 * GET /api/status — diagnóstico público e somente leitura:
 * confirma que as Functions estão no ar, que o D1 responde e que o OAuth2 do Discord está configurado.
 * Não expõe dados de usuários nem aceita gravações.
 */
import { json } from "../../src/lib/http.js";

const CHAVE = "P26-2A-3195-12EC-5382-8226";

export async function onRequestGet({ env }) {
  let d1Connected = false;
  let schemaReady = false;
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('users','sessions','habits','completions')"
    ).first();
    d1Connected = true;
    schemaReady = Number(row?.n) === 4;
  } catch {
    d1Connected = false;
  }
  return json({
    ok: d1Connected && schemaReady,
    chave: CHAVE,
    projeto: "#10 — Rastreador de Hábitos (Habit Tracker)",
    d1Connected,
    schemaReady,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    serverTime: new Date().toISOString(),
  });
}
