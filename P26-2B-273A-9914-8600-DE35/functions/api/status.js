/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const chave = "P26-2B-273A-9914-8600-DE35";
  const projectId = 19;
  const projectTitle = "Repositório de Resumos e Snippets da Turma";

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;
    let ultimosRegistros = [];

    if (env.DB) {
      try {
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, chave_projeto TEXT NOT NULL, conteudo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ).run();
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
      totalRegistros,
      ultimosRegistros,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "discord_demo_user").trim().slice(0, 64);
    const username = String(body.username || "Estudante").trim().slice(0, 80);
    const conteudo = String(body.conteudo || "").trim().slice(0, 500);

    if (!conteudo) {
      return Response.json({ ok: false, error: "Conteúdo obrigatório." }, { status: 400 });
    }

    if (env.DB) {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, chave_projeto TEXT NOT NULL, conteudo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
      ).run();
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
