// /api/status: verificação simples de saúde do deploy (não expõe dados de usuários).
export async function onRequestGet({ env }) {
  let d1Connected = false;
  try {
    if (env.DB) { await env.DB.prepare('SELECT 1').first(); d1Connected = true; }
  } catch { /* banco indisponível */ }
  return Response.json({
    ok: true,
    chave: 'P26-2A-A9AC-2CD1-5F84-AC20',
    projectId: 11,
    projectTitle: 'Controle Financeiro Pessoal',
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    serverTimestamp: new Date().toISOString(),
  });
}
