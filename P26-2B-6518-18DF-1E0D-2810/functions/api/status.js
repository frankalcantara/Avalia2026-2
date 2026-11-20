export async function onRequestGet({ env }) {
  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS connected").first();
      d1Connected = true;
    } catch {
      d1Connected = false;
    }
  }

  return Response.json({
    ok: true,
    chave: "P26-2B-6518-18DF-1E0D-2810",
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    serverTimestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
