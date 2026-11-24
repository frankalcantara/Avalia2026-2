export async function onRequest(context) {
  const { request, env } = context;
  const chave = "P26-2B-5505-D65C-D22D-30ED";
  const projectId = 12;
  const projectTitle = "Bloco de Notas em Markdown com Tags";

  let dbConnected = false;
  let totalRegistros = 0;
  let ultimosRegistros = [];
  let authenticated = false;
  let user = null;

  if (env.DB) {
    try {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, conteudo TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
      ).run();

      const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM project_records").first();
      const listRes = await env.DB.prepare("SELECT id, user_id, username, conteudo, created_at FROM project_records ORDER BY id DESC LIMIT 5").all();

      dbConnected = true;
      totalRegistros = Number(countRow?.total || 0);
      ultimosRegistros = listRes.results || [];

      // Verifica o cookie de sessão do Discord
      const cookieHeader = request.headers.get("Cookie") || "";
      const sessionMatch = cookieHeader.match(/session=([^;]+)/);

      if (sessionMatch) {
        const discordId = sessionMatch[1];
        const userRow = await env.DB.prepare("SELECT id, discord_id, username, avatar FROM users WHERE discord_id = ?")
          .bind(discordId)
          .first();

        if (userRow) {
          authenticated = true;
          user = userRow;
        }
      }
    } catch (err) {
      dbConnected = false;
    }
  }

  return Response.json({
    ok: true,
    chave,
    projectId,
    projectTitle,
    dbConnected,
    totalRegistros,
    ultimosRegistros,
    authenticated,
    user
  });
}