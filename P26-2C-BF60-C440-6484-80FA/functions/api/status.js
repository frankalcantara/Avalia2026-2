// GET /api/status — diagnóstico: chave do projeto, D1 acessível e Discord configurado.
import { json, route } from "../../src/http.js";
import { discordConfigured } from "../../src/auth.js";

const CHAVE = "P26-2C-BF60-C440-6484-80FA";

export const onRequestGet = route(async ({ env }) => {
  let d1 = false;
  if (env.DB) {
    try {
      // Confere também se a migração foi aplicada (tabela users existe).
      await env.DB.prepare("SELECT 1 FROM users LIMIT 1").all();
      d1 = true;
    } catch (err) {
      console.error("D1 indisponível:", err && err.message);
    }
  }
  return json({ ok: true, chave: CHAVE, d1, discord_configured: discordConfigured(env) });
});
