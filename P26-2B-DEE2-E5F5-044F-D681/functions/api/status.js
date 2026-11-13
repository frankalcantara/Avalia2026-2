/** GET /api/status — diagnóstico: D1 conectado, tabelas criadas e Discord configurado. */
import { json, CHAVE } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  let d1 = false;
  let tabelas = [];
  try {
    const r = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('discord_users','sessions','items','claims') ORDER BY name"
    ).all();
    tabelas = (r.results || []).map((t) => t.name);
    d1 = true;
  } catch {}
  return json({
    ok: d1 && tabelas.length === 4,
    chave: CHAVE,
    projeto: "#34 Vitrine de Achados e Perdidos do Campus",
    d1Conectado: d1,
    tabelas,
    discordConfigurado: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    horaServidor: new Date().toISOString(),
  });
}
