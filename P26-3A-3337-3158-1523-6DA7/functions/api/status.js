import {
  json,
  getSessionUser,
  ensureSchema,
  CHAVE_PROJETO,
  TOTAL_REQUIRED,
  CAP_PER_CATEGORY,
  getSecret,
} from "../_utils.js";

/** /api/status — saude da API, conectividade com o D1 e usuario da sessao (se houver). */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const user = await getSessionUser(request, env);
  let dbConnected = false;

  if (env.DB) {
    try {
      await ensureSchema(env);
      await env.DB.prepare("SELECT 1 AS ok").first();
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
  }

  return json({
    ok: true,
    chave: CHAVE_PROJETO,
    projectId: 20,
    projectTitle: "Gerenciador de Horas Complementares",
    d1Connected: dbConnected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && getSecret(env)),
    sessionUser: user,
    requiredHours: TOTAL_REQUIRED,
    capPerCategory: CAP_PER_CATEGORY,
    serverTimestamp: new Date().toISOString(),
  });
}
