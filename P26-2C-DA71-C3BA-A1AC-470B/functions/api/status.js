// GET /api/status — diagnóstico público (somente leitura).
import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  let d1Connected = false;
  let products = 0;
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM products").first();
    products = Number(row?.n || 0);
    d1Connected = true;
  } catch (err) {
    console.error("D1 indisponível:", err);
  }
  return json({
    ok: true,
    chave: "P26-2C-DA71-C3BA-A1AC-470B",
    projectId: 35,
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    products,
    serverTimestamp: new Date().toISOString(),
  });
}
