/**
 * Cloudflare Pages Function — /api/chamados
 * API REST do Rastreador de Solicitações e Chamados Internos (Projeto #38)
 * Valida sessão Discord OAuth2, regras de negócio no servidor e persiste no Cloudflare D1.
 */

const CHAVE_PROJETO = "P26-2B-2D44-2B7F-3524-711D";
const CATEGORIAS_VALIDAS = ["TI & Suporte", "Infraestrutura", "Acessos & Contas", "Sistemas & Software", "Administrativo"];
const PRIORIDADES_VALIDAS = ["Baixa", "Média", "Alta", "Urgente"];
const STATUS_VALIDOS = ["Aberto", "Em Andamento", "Concluído"];

function getSessionUser(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionMatch = cookieHeader.match(/discord_session=([^;]+)/);
  if (sessionMatch) {
    try {
      const parsed = JSON.parse(decodeURIComponent(atob(sessionMatch[1])));
      if (parsed && parsed.id && parsed.username) {
        return {
          id: String(parsed.id).slice(0, 64),
          username: String(parsed.username).slice(0, 80),
          avatar: parsed.avatar ? String(parsed.avatar).slice(0, 255) : null,
          isDemo: false,
        };
      }
    } catch {}
  }
  return null;
}

async function ensureTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS chamados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      titulo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      prioridade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Aberto',
      descricao TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS project_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      chave_projeto TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    return Response.json(
      { ok: false, error: "Banco de dados Cloudflare D1 (binding DB) não configurado." },
      { status: 503 }
    );
  }

  await ensureTables(env.DB);
  const sessionUser = getSessionUser(request);

  // GET /api/chamados — Lista chamados com filtros opcionais e métricas
  if (request.method === "GET") {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || "";
    const prioridadeFilter = url.searchParams.get("prioridade") || "";
    const busca = (url.searchParams.get("q") || "").trim().toLowerCase();

    const { results } = await env.DB.prepare(
      "SELECT id, user_id, username, avatar, titulo, categoria, prioridade, status, descricao, created_at, updated_at FROM chamados ORDER BY id DESC"
    ).all();

    const todos = results || [];

    const metricas = {
      total: todos.length,
      abertos: todos.filter((c) => c.status === "Aberto").length,
      emAndamento: todos.filter((c) => c.status === "Em Andamento").length,
      concluidos: todos.filter((c) => c.status === "Concluído").length,
      urgentes: todos.filter((c) => c.prioridade === "Urgente" && c.status !== "Concluído").length,
    };

    const filtrados = todos.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (prioridadeFilter && c.prioridade !== prioridadeFilter) return false;
      if (busca) {
        const texto = `${c.titulo} ${c.descricao} ${c.categoria} ${c.username}`.toLowerCase();
        if (!texto.includes(busca)) return false;
      }
      return true;
    });

    return Response.json({
      ok: true,
      chave: CHAVE_PROJETO,
      metricas,
      chamados: filtrados,
    });
  }

  // POST /api/chamados — Cria um novo chamado após validação estrita no servidor
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ ok: false, error: "Corpo JSON inválido." }, { status: 400 });
    }

    // Usa sessão OAuth2 real se disponível; em ambiente local sem OAuth2 configurado, exige identificação explícita
    const autor = sessionUser || (
      !env.DISCORD_CLIENT_ID && body.localUser?.username
        ? {
            id: String(body.localUser.id || "local_discord_user").trim().slice(0, 64),
            username: String(body.localUser.username).trim().slice(0, 80),
            avatar: null,
          }
        : null
    );

    if (!autor) {
      return Response.json(
        { ok: false, error: "Autenticação Discord obrigatória para registrar chamados." },
        { status: 401 }
      );
    }

    const titulo = String(body.titulo || "").trim();
    const categoria = String(body.categoria || "").trim();
    const prioridade = String(body.prioridade || "").trim();
    const descricao = String(body.descricao || "").trim();

    if (titulo.length < 4 || titulo.length > 120) {
      return Response.json(
        { ok: false, error: "O título do chamado deve ter entre 4 e 120 caracteres." },
        { status: 400 }
      );
    }

    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return Response.json(
        { ok: false, error: "Categoria inválida selecionada." },
        { status: 400 }
      );
    }

    if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
      return Response.json(
        { ok: false, error: "Prioridade inválida selecionada." },
        { status: 400 }
      );
    }

    if (descricao.length < 10 || descricao.length > 1000) {
      return Response.json(
        { ok: false, error: "A descrição deve ter entre 10 e 1000 caracteres." },
        { status: 400 }
      );
    }

    const insertRes = await env.DB.prepare(
      `INSERT INTO chamados (user_id, username, avatar, titulo, categoria, prioridade, status, descricao)
       VALUES (?, ?, ?, ?, ?, ?, 'Aberto', ?)`
    )
      .bind(autor.id, autor.username, autor.avatar, titulo, categoria, prioridade, descricao)
      .run();

    // Registra auditoria também em project_records para rastreabilidade da chave
    await env.DB.prepare(
      "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
    )
      .bind(autor.id, autor.username, CHAVE_PROJETO, `[Chamado #${insertRes.meta?.last_row_id || "novo"}] ${titulo} (${prioridade})`)
      .run();

    return Response.json(
      {
        ok: true,
        id: insertRes.meta?.last_row_id || null,
        message: "Chamado registrado com sucesso!",
      },
      { status: 201 }
    );
  }

  // PATCH /api/chamados — Atualiza o status do chamado no servidor
  if (request.method === "PATCH") {
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    const novoStatus = String(body?.status || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ ok: false, error: "ID de chamado inválido." }, { status: 400 });
    }

    if (!STATUS_VALIDOS.includes(novoStatus)) {
      return Response.json({ ok: false, error: "Status inválido." }, { status: 400 });
    }

    const existente = await env.DB.prepare("SELECT id FROM chamados WHERE id = ?").bind(id).first();
    if (!existente) {
      return Response.json({ ok: false, error: "Chamado não encontrado." }, { status: 404 });
    }

    await env.DB.prepare(
      "UPDATE chamados SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(novoStatus, id)
      .run();

    return Response.json({ ok: true, id, status: novoStatus });
  }

  // DELETE /api/chamados?id=X — Remove um chamado
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ ok: false, error: "ID de chamado inválido." }, { status: 400 });
    }

    const delRes = await env.DB.prepare("DELETE FROM chamados WHERE id = ?").bind(id).run();
    if (!delRes.meta?.changes) {
      return Response.json({ ok: false, error: "Chamado não encontrado." }, { status: 404 });
    }

    return Response.json({ ok: true, deletedId: id });
  }

  return Response.json({ ok: false, error: "Método HTTP não permitido." }, { status: 405 });
}