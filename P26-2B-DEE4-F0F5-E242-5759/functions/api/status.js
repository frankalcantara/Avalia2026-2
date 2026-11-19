import { error, json, withDb } from "../_shared/api.js";
import { oauthConfigured, sessionUser as readSessionUser } from "../_shared/session.js";

const chave = "P26-2B-DEE4-F0F5-E242-5759";

/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
export async function onRequestGet({ request, env }) {
  let sessionUser = null;
  let d1Connected = false;
  let totalRegistros = 0;
  let ultimosRegistros = [];

  if (env.DB) {
    try {
      await env.DB.prepare("SELECT id FROM rides LIMIT 1").first();
      sessionUser = await readSessionUser(request, env);
      if (sessionUser) {
        const { total } = await env.DB.prepare("SELECT COUNT(*) AS total FROM project_records WHERE user_id = ?")
          .bind(sessionUser.userId).first();
        const { results } = await env.DB.prepare(
          "SELECT id, user_id, username, conteudo, created_at FROM project_records WHERE user_id = ? ORDER BY id DESC LIMIT 10"
        ).bind(sessionUser.userId).all();
        totalRegistros = total;
        ultimosRegistros = results;
      }
      d1Connected = true;
    } catch (err) {
      console.error("Falha no diagnóstico do D1", err);
    }
  }

  return json({
    ok: true,
    chave,
    projectId: 31,
    projectTitle: "Quadro de Caronas Universitárias",
    d1Connected,
    discordOAuthConfigured: oauthConfigured(env),
    sessionUser,
    totalRegistros,
    ultimosRegistros,
    serverTimestamp: new Date().toISOString(),
  });
}

export const onRequestPost = withDb(async ({ request, env }, user) => {
  const body = await request.json().catch(() => null);
  const conteudo = typeof body?.conteudo === "string" ? body.conteudo.trim() : "";
  if (!conteudo || conteudo.length > 500) return error("conteudo_invalido", 400);
  await env.DB.prepare(
    "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
  ).bind(user.userId, user.username, chave, conteudo).run();
  return json({ ok: true, saved: true, chave, serverTimestamp: new Date().toISOString() }, 201);
}, true);
