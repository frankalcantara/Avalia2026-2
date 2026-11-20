import { readSession } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const s = await readSession(request, env.SESSION_SECRET);
  let d1Connected = false;
  let totalRegistros = 0;
  try {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM kudos").first();
    totalRegistros = r.n;
    d1Connected = true;
  } catch {}
  return Response.json({
    ok: true,
    chave: "P26-2C-9700-D26E-48A3-4886",
    projectId: 29,
    projectTitle: "Mural de Reconhecimento (Kudos Board)",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
    sessionUser: s ? { userId: s.userId, username: s.username, avatar: s.avatar } : null,
    totalRegistros,
    ultimosRegistros: [],
    serverTimestamp: new Date().toISOString(),
  });
}
