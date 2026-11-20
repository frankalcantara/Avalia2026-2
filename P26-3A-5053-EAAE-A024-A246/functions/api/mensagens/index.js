
import { getSessionUser, json } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, erro: "Banco de dados indisponível." }, 503);
    }

    const usuario = await getSessionUser(request, env);

    if (!usuario) {
      return json({ ok: false, erro: "Faça login para continuar." }, 401);
    }

    const url = new URL(request.url);
    const emprestimoId = Number(url.searchParams.get("emprestimo_id"));

    if (!Number.isInteger(emprestimoId) || emprestimoId <= 0) {
      return json({ ok: false, erro: "Solicitação inválida." }, 400);
    }

    const solicitacao = await env.DB.prepare(`
      SELECT
        e.id,
        e.solicitante_id,
        l.dono_id
      FROM emprestimos e
      INNER JOIN livros l ON l.id = e.livro_id
      WHERE e.id = ?
    `).bind(emprestimoId).first();

    if (!solicitacao) {
      return json({ ok: false, erro: "Solicitação não encontrada." }, 404);
    }

    const participa =
      usuario.user_id === solicitacao.solicitante_id ||
      usuario.user_id === solicitacao.dono_id;

    if (!participa) {
      return json({ ok: false, erro: "Acesso não autorizado." }, 403);
    }

    const resultado = await env.DB.prepare(`
      SELECT
        m.id,
        m.emprestimo_id,
        m.remetente_id,
        m.conteudo,
        m.criada_em,
        u.username,
        u.global_name
      FROM mensagens_emprestimos m
      INNER JOIN discord_users u ON u.user_id = m.remetente_id
      WHERE m.emprestimo_id = ?
      ORDER BY m.id ASC
    `).bind(emprestimoId).all();

    return json({
      ok: true,
      mensagens: resultado.results || []
    });

  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return json({ ok: false, erro: "Não foi possível carregar as mensagens." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, erro: "Banco de dados indisponível." }, 503);
    }

    const usuario = await getSessionUser(request, env);

    if (!usuario) {
      return json({ ok: false, erro: "Faça login para continuar." }, 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, erro: "JSON inválido." }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, erro: "Dados inválidos." }, 400);
    }

    const emprestimoId = Number(body.emprestimo_id);
    const conteudo = typeof body.conteudo === "string"
      ? body.conteudo.trim()
      : "";

    if (!Number.isInteger(emprestimoId) || emprestimoId <= 0) {
      return json({ ok: false, erro: "Solicitação inválida." }, 400);
    }

    if (!conteudo || conteudo.length > 1000) {
      return json({ ok: false, erro: "A mensagem deve ter entre 1 e 1000 caracteres." }, 400);
    }

    const solicitacao = await env.DB.prepare(`
      SELECT
        e.id,
        e.status,
        e.solicitante_id,
        l.dono_id
      FROM emprestimos e
      INNER JOIN livros l ON l.id = e.livro_id
      WHERE e.id = ?
    `).bind(emprestimoId).first();

    if (!solicitacao) {
      return json({ ok: false, erro: "Solicitação não encontrada." }, 404);
    }

    const participa =
      usuario.user_id === solicitacao.solicitante_id ||
      usuario.user_id === solicitacao.dono_id;

    if (!participa) {
      return json({ ok: false, erro: "Acesso não autorizado." }, 403);
    }

    if (!["Pendente", "Aprovado"].includes(solicitacao.status)) {
      return json({
        ok: false,
        erro: "Esta conversa está encerrada e não aceita novas mensagens."
      }, 409);
    }

    const insercao = await env.DB.prepare(`
      INSERT INTO mensagens_emprestimos (
        emprestimo_id,
        remetente_id,
        conteudo
      )
      VALUES (?, ?, ?)
    `).bind(
      emprestimoId,
      usuario.user_id,
      conteudo
    ).run();

    return json({
      ok: true,
      mensagem: "Mensagem enviada.",
      id: insercao.meta.last_row_id
    }, 201);

  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return json({ ok: false, erro: "Não foi possível enviar a mensagem." }, 500);
  }
}
