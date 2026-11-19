import { readSession } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  let d1Connected = false;
  try {
    await env.DB.prepare("SELECT 1").first();
    d1Connected = true;
  } catch {}
  return Response.json({
    ok: true,
    chave: "P26-2C-D74F-99D3-3096-8A00",
    projectId: 34,
    projectTitle: "Vitrine de Achados e Perdidos do Campus",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
    sessionUser: await readSession(request, env),
    serverTimestamp: new Date().toISOString(),
  });
}