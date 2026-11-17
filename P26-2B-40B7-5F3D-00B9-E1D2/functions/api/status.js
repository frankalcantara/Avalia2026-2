import { getCookie, verifySession } from "../../lib/session.js";

const AVATAR_PADRAO = "https://cdn.discordapp.com/embed/avatars/0.png";

// Só aceitamos imagem hospedada no CDN do Discord.
function avatarSeguro(url) {
  return typeof url === "string" && url.startsWith("https://cdn.discordapp.com/")
    ? url
    : AVATAR_PADRAO;
}

/**
 * GET /api/status — diagnóstico e sessão atual.
 * Não lista dados de ninguém e não grava nada.
 */
export async function onRequestGet({ request, env }) {
  let sessionUser = null;
  const token = getCookie(request, "discord_session");
  if (token && env.SESSION_SECRET) {
    const sessao = await verifySession(token, env.SESSION_SECRET);
    if (sessao) {
      // Montamos um objeto novo: nada além do que a página usa sai daqui.
      sessionUser = {
        userId: sessao.userId,
        username: String(sessao.username || "").slice(0, 80),
        avatar: avatarSeguro(sessao.avatar),
      };
    }
  }

  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1").first();
      d1Connected = true;
    } catch (e) {
      console.error("Falha ao consultar o D1:", e);
    }
  }

  return Response.json(
    {
      ok: true,
      chave: "P26-2B-40B7-5F3D-00B9-E1D2",
      projectId: 14,
      projectTitle: "Diário de Bordo de Projetos",
      d1Connected,
      discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
      sessionUser,
      serverTimestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Qualquer outro método (POST, PUT, DELETE...) é recusado.
export async function onRequest() {
  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}