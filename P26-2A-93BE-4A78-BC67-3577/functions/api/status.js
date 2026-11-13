/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
import { getSessionUser } from "../_lib/session.js";

export async function onRequest(context) {
  const { request, env } = context;
  const chave = "P26-2A-93BE-4A78-BC67-3577";
  const projectId = 3;
  const projectTitle = "Batalha Naval Tático";

  // Usuário autenticado vem da sessão guardada no D1 (o cookie só tem um token aleatório)
  const sessionUser = await getSessionUser(env, request);

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;
    let ultimosRegistros = [];

    if (env.DB) {
      try {
        const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM project_records").first();
        const listRes = await env.DB.prepare("SELECT id, user_id, username, conteudo, created_at FROM project_records ORDER BY id DESC LIMIT 10").all();
        dbConnected = true;
        totalRegistros = Number(countRow?.total || 0);
        ultimosRegistros = listRes.results || [];
      } catch (err) {
        dbConnected = false;
      }
    }

    return Response.json({
      ok: true,
      chave,
      projectId,
      projectTitle,
      d1Connected: dbConnected,
      discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
      sessionUser,
      totalRegistros,
      ultimosRegistros,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!sessionUser) {
      return Response.json({ ok: false, error: "Login obrigatório." }, { status: 401 });
    }
    const userId = sessionUser.userId;
    const username = sessionUser.username;
    const conteudo = String(body.conteudo || "").trim().slice(0, 500);

    if (!conteudo) {
      return Response.json({ ok: false, error: "Conteúdo obrigatório." }, { status: 400 });
    }

    if (env.DB) {
      await env.DB.prepare(
        "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
      ).bind(userId, username, chave, conteudo).run();
    }

    return Response.json({
      ok: true,
      saved: Boolean(env.DB),
      chave,
      serverTimestamp: new Date().toISOString(),
    }, { status: 201 });
  }

  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
