/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
import { readSession } from "../_lib/session.js";

export async function onRequest(context) {
  const { request, env } = context;
  const chave = "P26-2B-8F20-6829-E280-0237";
  const projectId = 4;
  const projectTitle = "Sudoku com Validador e Cronômetro";
  const sessionUser = await readSession(request, env.SESSION_SECRET);

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;
    let ultimosRegistros = [];
    let d1Error = null;

    if (env.DB) {
      try {
        await env.DB.prepare("SELECT 1").first();
        dbConnected = true;
      } catch (err) {
        console.error("D1 status check failed.", err);
        d1Error = "database_unavailable";
      }

      if (dbConnected && sessionUser) {
        try {
          const countRow = await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM project_records WHERE user_id = ?"
          ).bind(sessionUser.userId).first();
          const listRes = await env.DB.prepare(
            "SELECT id, user_id, username, conteudo, created_at FROM project_records WHERE user_id = ? ORDER BY id DESC LIMIT 10"
          ).bind(sessionUser.userId).all();
          totalRegistros = Number(countRow.total);
          ultimosRegistros = listRes.results || [];
        } catch (err) {
          console.error("D1 diagnostic records query failed.", err);
          dbConnected = false;
          d1Error = "records_unavailable";
        }
      }
    }

    return Response.json({
      ok: true,
      chave,
      projectId,
      projectTitle,
      d1Connected: dbConnected,
      d1Error,
      discordOAuthConfigured: Boolean(
        env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.SESSION_SECRET,
      ),
      sessionUser,
      totalRegistros,
      ultimosRegistros,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (request.method === "POST") {
    if (!sessionUser) {
      return Response.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const conteudo = body && typeof body.conteudo === "string" ? body.conteudo.trim() : "";

    if (!conteudo || conteudo.length > 500) {
      return Response.json({ ok: false, error: "invalid_content" }, { status: 400 });
    }

    if (!env.DB) {
      return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
    }

    try {
      await env.DB.prepare(
        "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
      ).bind(sessionUser.userId, sessionUser.username, chave, conteudo).run();
    } catch (err) {
      console.error("D1 diagnostic record insert failed.", err);
      return Response.json({ ok: false, error: "record_persistence_failed" }, { status: 503 });
    }

    return Response.json({
      ok: true,
      saved: true,
      chave,
      serverTimestamp: new Date().toISOString(),
    }, { status: 201 });
  }

  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
