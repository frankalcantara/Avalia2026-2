export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // 1. Validar autenticação via Cookie de Sessão do Discord
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionMatch = cookieHeader.match(/session=([^;]+)/);

  if (!sessionMatch) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const discordId = sessionMatch[1];
  const user = await env.DB.prepare("SELECT id FROM users WHERE discord_id = ?")
    .bind(discordId)
    .first();

  if (!user) {
    return Response.json({ error: "Utilizador não encontrado" }, { status: 401 });
  }

  const userId = user.id;

  // 2. Método GET: Listar notas do utilizador (com filtro opcional por tag ou termo de pesquisa)
  if (method === "GET") {
    const search = url.searchParams.get("search") || "";
    const tagFilter = url.searchParams.get("tag") || "";

    let query = `
      SELECT DISTINCT n.id, n.title, n.content, n.created_at, n.updated_at 
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.user_id = ?
    `;
    let params = [userId];

    if (search) {
      query += ` AND (n.title LIKE ? OR n.content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (tagFilter) {
      query += ` AND t.name = ?`;
      params.push(tagFilter);
    }

    query += ` ORDER BY n.updated_at DESC`;

    const notesRes = await env.DB.prepare(query).bind(...params).all();
    const notes = notesRes.results || [];

    // Buscar etiquetas associadas a cada nota
    for (let note of notes) {
      const tagsRes = await env.DB.prepare(`
        SELECT t.name FROM tags t
        JOIN note_tags nt ON t.id = nt.tag_id
        WHERE nt.note_id = ?
      `).bind(note.id).all();
      note.tags = (tagsRes.results || []).map(t => t.name);
    }

    return Response.json({ notes });
  }

  // 3. Método POST: Criar ou atualizar uma nota
  if (method === "POST") {
    try {
      const body = await request.json();
      const { title, content, tags } = body;

      if (!content) {
        return Response.json({ error: "O conteúdo da nota é obrigatório" }, { status: 400 });
      }

      const noteId = crypto.randomUUID();
      const noteTitle = title || content.split('\n')[0].substring(0, 30) || "Nota Sem Título";

      // Inserir a nota na base de dados
      await env.DB.prepare(
        "INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)"
      ).bind(noteId, userId, noteTitle, content).run();

      // Processar e associar etiquetas (tags)
      if (tags && Array.isArray(tags)) {
        for (let tagName of tags) {
          const cleanTag = tagName.trim().toLowerCase();
          if (!cleanTag) continue;

          let tag = await env.DB.prepare("SELECT id FROM tags WHERE name = ?").bind(cleanTag).first();
          let tagId;

          if (!tag) {
            tagId = crypto.randomUUID();
            await env.DB.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").bind(tagId, cleanTag).run();
          } else {
            tagId = tag.id;
          }

          await env.DB.prepare(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"
          ).bind(noteId, tagId).run();
        }
      }

      return Response.json({ success: true, noteId });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // 4. Método DELETE: Apagar nota por ID
  if (method === "DELETE") {
    const noteId = url.searchParams.get("id");
    if (!noteId) {
      return Response.json({ error: "ID da nota não fornecido" }, { status: 400 });
    }

    const note = await env.DB.prepare("SELECT id FROM notes WHERE id = ? AND user_id = ?").bind(noteId, userId).first();
    if (!note) {
      return Response.json({ error: "Nota não encontrada ou sem permissão" }, { status: 404 });
    }

    await env.DB.prepare("DELETE FROM note_tags WHERE note_id = ?").bind(noteId).run();
    await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(noteId).run();

    return Response.json({ success: true });
  }

  return Response.json({ error: "Método não suportado" }, { status: 405 });
}