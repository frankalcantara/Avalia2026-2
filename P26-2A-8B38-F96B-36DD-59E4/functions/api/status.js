import { sessao } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const sessionUser = await sessao(request, env);
  let d1Connected = false;
  try { await env.DB.prepare("SELECT 1").first(); d1Connected = true; } catch {}
  return Response.json({
    ok: true,
    chave: "P26-2A-8B38-F96B-36DD-59E4",
    projectId: 23,
    projectTitle: "Gerador e Organizador de Referências Bibliográficas",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
    sessionUser,
    serverTimestamp: new Date().toISOString(),
  });
}
