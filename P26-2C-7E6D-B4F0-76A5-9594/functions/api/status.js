/**
 * Cloudflare Pages Function — /api/status
 * Diagnóstico: conexão com o D1, configuração do Discord e sessão atual.
 */
import { readSession } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const sessao = await readSession(request, env.SESSION_SECRET);
  const sessionUser = sessao
    ? { userId: sessao.userId, username: sessao.username, avatar: sessao.avatar }
    : null;

  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1").first();
      d1Connected = true;
    } catch {}
  }

  return Response.json({
    ok: true,
    chave: "P26-2C-7E6D-B4F0-76A5-9594",
    projectId: 20,
    projectTitle: "Gerenciador de Horas Complementares",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
    sessionUser,
    serverTimestamp: new Date().toISOString(),
  });
}