/**
 * /api/status — diagnóstico do deploy (somente leitura, sem dados de usuários).
 * Mostra se o D1 responde e se as variáveis obrigatórias existem (nunca os valores).
 */
export async function onRequestGet({ env }) {
  let d1 = false;
  try {
    if (env.DB) { await env.DB.prepare("SELECT 1").first(); d1 = true; }
  } catch { d1 = false; }
  return Response.json({
    ok: true,
    chave: "P26-2A-557F-D130-1422-DA84",
    projeto: "15 - Lista de Tarefas Colaborativa (Shared To-Do)",
    d1Conectado: d1,
    discordConfigurado: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    sessaoConfigurada: Boolean(env.SESSION_SECRET),
    horaDoServidor: new Date().toISOString(),
  });
}
