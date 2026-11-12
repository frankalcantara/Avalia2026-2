import { route, statusBody } from "../../lib/api.js";

const chave = "P26-3A-4CE1-8C26-8C01-F50F";

const postStatus = route(["POST"], async (context) => {
  const { request, env } = context;
  const { conteudo } = await statusBody(request);
  const { user_id: userId, username } = context.data.user;

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, chave_projeto TEXT NOT NULL, conteudo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  ).run();
  await env.DB.prepare(
    "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
  ).bind(userId, username, chave, conteudo).run();

  return Response.json({
    ok: true,
    saved: Boolean(env.DB),
    chave,
    serverTimestamp: new Date().toISOString(),
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
});

/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const projectId = 42;
  const projectTitle = "Agregador e Curadoria de Links Técnicos (Bookmark Manager)";

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;

    if (env.DB) {
      try {
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, chave_projeto TEXT NOT NULL, conteudo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ).run();
        const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM project_records").first();
        dbConnected = true;
        totalRegistros = Number(countRow?.total || 0);
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
      sessionUser: null,
      totalRegistros,
      ultimosRegistros: [],
      serverTimestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (request.method === "POST") {
    return postStatus(context);
  }

  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
