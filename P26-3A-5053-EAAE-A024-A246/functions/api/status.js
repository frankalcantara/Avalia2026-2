import { json } from "../_lib/session.js";

const PROJECT_KEY = "P26-3A-5053-EAAE-A024-A246";

export async function onRequestGet({ env }) {
  let d1Connected = false;

  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1").first();
      d1Connected = true;
    } catch (error) {
      console.error("D1 status check failed.", error);
    }
  }

  return json({
    ok: true,
    chave: PROJECT_KEY,
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    serverTimestamp: new Date().toISOString(),
  });
}
