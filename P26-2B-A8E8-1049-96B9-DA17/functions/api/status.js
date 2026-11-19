import { json, methodNotAllowed } from "../_lib/http.js";

/** Diagnóstico somente leitura, sem dados sensíveis nem de usuários. */
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  let d1Connected = false;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      d1Connected = true;
    } catch {}
  }
  return json({
    ok: true,
    chave: "P26-2B-A8E8-1049-96B9-DA17",
    projectId: 41,
    d1Connected,
    discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    sessionConfigured: Boolean(env.SESSION_SECRET),
    serverTimestamp: new Date().toISOString(),
  });
}
