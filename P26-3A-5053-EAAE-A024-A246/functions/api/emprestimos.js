import { getSessionUser, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, error: "Banco de dados indisponível." }, 503);
    }

    const user = await getSessionUser(request, env);

    if (!user) {
      return json({ ok: false, error: "Faça login com Discord." }, 401);
    }

    const result = await env.DB.prepare(`
      SELECT
        e.id,
        e.livro_id,
        e.solicitante_id,
        e.status,
        e.mensagem,
        e.data_prevista_devolucao,
        e.decidido_em,
        e.devolvido_em,
        e.devolucao_solicitada_em,
        l.titulo,
        l.autor,
        l.dono_id,
        solicitante.username AS solicitante_username,
        solicitante.global_name AS solicitante_global_name,
        dono.username AS dono_username,
        dono.global_name AS dono_global_name
      FROM emprestimos e
      JOIN livros l ON l.id = e.livro_id
      JOIN discord_users solicitante
        ON solicitante.user_id = e.solicitante_id
      JOIN discord_users dono
        ON dono.user_id = l.dono_id
      WHERE e.solicitante_id = ?
         OR l.dono_id = ?
      ORDER BY e.id DESC
    `).bind(user.user_id, user.user_id).all();

    return json({
      ok: true,
      emprestimos: result.results || []
    });
  } catch (error) {
    console.error("Erro ao consultar empréstimos.");
    return json({
      ok: false,
      error: "Não foi possível carregar os empréstimos."
    }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({ ok: false, error: "Banco de dados indisponível." }, 503);
    }

    const user = await getSessionUser(request, env);

    if (!user) {
      return json({ ok: false, error: "Faça login com Discord." }, 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Dados inválidos." }, 400);
    }

    const livroId = Number(body.livro_id);
    const mensagem = typeof body.mensagem === "string"
      ? body.mensagem.trim()
      : "";

    if (!Number.isSafeInteger(livroId) || livroId <= 0) {
      return json({ ok: false, error: "Livro inválido." }, 400);
    }

    if (mensagem.length > 500) {
      return json({ ok: false, error: "Mensagem muito longa." }, 400);
    }

    const livro = await env.DB.prepare(`
      SELECT id, dono_id, modalidade, status
      FROM livros
      WHERE id = ?
    `).bind(livroId).first();

    if (!livro) {
      return json({ ok: false, error: "Livro não encontrado." }, 404);
    }

    if (livro.dono_id === user.user_id) {
      return json({
        ok: false,
        error: "Você não pode solicitar seu próprio livro."
      }, 400);
    }

    if (!["Emprestar", "Ambos"].includes(livro.modalidade)) {
      return json({
        ok: false,
        error: "Este livro não está disponível para empréstimo."
      }, 400);
    }

    if (livro.status !== "Disponível") {
      return json({
        ok: false,
        error: "Este livro não está disponível no momento."
      }, 409);
    }

    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO emprestimos (
          livro_id,
          solicitante_id,
          mensagem,
          status
        )
        SELECT ?, ?, ?, 'Pendente'
        WHERE EXISTS (
          SELECT 1
          FROM livros
          WHERE id = ?
            AND status = 'Disponível'
            AND dono_id != ?
            AND modalidade IN ('Emprestar', 'Ambos')
        )
      `).bind(
        livroId,
        user.user_id,
        mensagem || null,
        livroId,
        user.user_id
      ),

      env.DB.prepare(`
        UPDATE livros
        SET status = 'Reservado'
        WHERE id = ?
          AND EXISTS (
            SELECT 1
            FROM emprestimos
            WHERE livro_id = ?
              AND status IN ('Pendente', 'Aprovado')
          )
      `).bind(livroId, livroId)
    ]);

    if (!results[0].meta.changes) {
      return json({
        ok: false,
        error: "Este livro já recebeu uma solicitação ou não está disponível."
      }, 409);
    }

    return json({
      ok: true,
      message: "Solicitação enviada com sucesso.",
      id: results[0].meta.last_row_id
    }, 201);

  } catch (error) {
    console.error("Erro ao criar solicitação de empréstimo.");
    return json({
      ok: false,
      error: "Não foi possível solicitar este empréstimo."
    }, 500);
  }
}
