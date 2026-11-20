export async function onRequestGet({ env }) {
  let d1Connected = false;

  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1").first();
      d1Connected = true;
    } catch (error) {
      console.error("D1 health check failed:", error);
    }
  }

  return Response.json({
    ok: true,
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
  });
}
