import { json } from "../_shared/http.js";
import { readSession } from "../_shared/session.js";

export async function onRequestGet({ request, env }) {
  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS connected").first();
      d1Connected = true;
    } catch (error) {
      console.error("[API status] D1 connectivity check failed:", error);
    }
  }

  const user = await readSession(request, env.SESSION_SECRET);
  return json({
    ok: true,
    chave: "P26-2B-9844-B28F-C0A4-FF33",
    projectId: 22,
    projectTitle: "Fórum de Dúvidas em Formato Pergunta-Resposta",
    d1BindingConfigured: Boolean(env.DB),
    d1Connected,
    discordOAuthConfigured: Boolean(
      env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET &&
      typeof env.SESSION_SECRET === "string" &&
      env.SESSION_SECRET.length >= 32,
    ),
    sessionUser: user,
    serverTimestamp: new Date().toISOString(),
  });
}
