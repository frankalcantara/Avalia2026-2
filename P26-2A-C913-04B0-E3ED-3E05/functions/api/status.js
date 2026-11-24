import { getSession } from "./_shared/auth.js";

export async function onRequestGet({ request, env }) {
  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1").first();
      d1Connected = true;
    } catch {}
  }
  return Response.json({
    ok: true,
    chave: "P26-2A-C913-04B0-E3ED-3E05",
    projectTitle: "Quiz Competitivo Temporizado",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    sessionUser: await getSession(request, env),
    serverTimestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function onRequest() {
  return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET" } });
}
