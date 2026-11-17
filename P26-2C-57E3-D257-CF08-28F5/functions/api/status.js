import { getSessionUser } from "../_shared/session.js";
import { json } from "../_shared/http.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return json({ error: "Método não permitido." }, 405, { Allow: "GET" });
  }
  if (!env.DB) return json({ ok: false, error: "Banco D1 não configurado." }, 503);

  try {
    await env.DB.prepare("SELECT 1 AS connected").first();
    const sessionUser = await getSessionUser(request, env.SESSION_SECRET);
    return json({
      ok: true,
      d1Connected: true,
      discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      sessionUser,
      serverTimestamp: new Date().toISOString(),
    });
  } catch {
    return json({ ok: false, error: "Não foi possível verificar o banco ou a sessão." }, 500);
  }
}
