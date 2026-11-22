// GET /api/status — verificação de saúde (usada pelo agente de teste e validação).
import { json } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('users','sessions','decks','cards','reviews')").first();
  return json({
    ok: true,
    app: 'Memorize',
    chave: 'P26-2A-DF64-8C37-3512-F974',
    d1: Number(row?.n) === 5 ? 'ok' : 'migrações pendentes',
    discord_oauth: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
  });
}
