import { getSessionUser, json } from "../../_lib/session.js";

function validarDataPrevista(data) {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataTeste = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    dataTeste.getUTCFullYear() !== ano ||
    dataTeste.getUTCMonth() !== mes - 1 ||
    dataTeste.getUTCDate() !== dia
  ) {
    return false;
  }

  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return data > hoje;
}

export async function onRequestPost({ request, env, params }) {
  try {
    if (!env.DB) {
      return json({ ok: false, erro: "Banco de dados indisponível." }, 503);
    }

    const user = await getSessionUser(request, env);

    if (!user) {
      return json({ ok: false, erro: "Faça login para continuar." }, 401);
    }

    const id = Number(params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return json({ ok: false, erro: "ID de empréstimo inválido." }, 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, erro: "Envie um JSON válido." }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, erro: "Dados inválidos." }, 400);
    }

    const acao = body.acao;
    const acoesPermitidas = [
      "aprovar",
      "recusar",
      "solicitar_devolucao",
      "confirmar_devolucao"
    ];

    if (!acoesPermitidas.includes(acao)) {
      return json({ ok: false, erro: "Ação inválida." }, 400);
    }

    if (
      acao === "aprovar" &&
      !validarDataPrevista(body.data_prevista_devolucao)
    ) {
      return json({
        ok: false,
        erro: "Informe uma data válida e futura para a devolução."
      }, 400);
    }

    const emprestimo = await env.DB.prepare(`
      SELECT
        e.id,
        e.status,
        e.devolucao_solicitada_em,
        e.solicitante_id,
        l.dono_id,
        l.id AS livro_id
      FROM emprestimos e
      JOIN livros l ON l.id = e.livro_id
      WHERE e.id = ?
    `).bind(id).first();

    if (!emprestimo) {
      return json({ ok: false, erro: "Empréstimo não encontrado." }, 404);
    }

    const agora = new Date().toISOString();

    if (acao === "aprovar" || acao === "recusar") {
      if (emprestimo.dono_id !== user.user_id) {
        return json({ ok: false, erro: "Você não é o dono deste livro." }, 403);
      }

      if (emprestimo.status !== "Pendente") {
        return json({ ok: false, erro: "Esta solicitação já foi decidida." }, 409);
      }

      const novoStatus = acao === "aprovar" ? "Aprovado" : "Recusado";
      const novoStatusLivro = acao === "aprovar" ? "Emprestado" : "Disponível";

      const resultado = await env.DB.batch([
        env.DB.prepare(`
          UPDATE emprestimos
          SET
            status = ?,
            decidido_em = ?,
            data_prevista_devolucao = ?
          WHERE id = ?
            AND status = 'Pendente'
            AND EXISTS (
              SELECT 1
              FROM livros
              WHERE livros.id = emprestimos.livro_id
                AND livros.dono_id = ?
                AND livros.status = 'Reservado'
            )
        `).bind(
          novoStatus,
          agora,
          acao === "aprovar" ? body.data_prevista_devolucao : null,
          id,
          user.user_id
        ),

        env.DB.prepare(`
          UPDATE livros
          SET status = ?
          WHERE id = ?
            AND status = 'Reservado'
            AND EXISTS (
              SELECT 1
              FROM emprestimos
              WHERE emprestimos.id = ?
                AND emprestimos.status = ?
                AND emprestimos.decidido_em = ?
            )
        `).bind(novoStatusLivro, emprestimo.livro_id, id, novoStatus, agora)
      ]);

      if (!resultado[0].meta.changes || !resultado[1].meta.changes) {
        return json({
          ok: false,
          erro: "Não foi possível atualizar a solicitação. Atualize a página e tente novamente."
        }, 409);
      }

      return json({
        ok: true,
        mensagem: acao === "aprovar"
          ? "Empréstimo aprovado."
          : "Solicitação recusada."
      });
    }

    if (acao === "solicitar_devolucao") {
      if (emprestimo.solicitante_id !== user.user_id) {
        return json({ ok: false, erro: "Você não é o solicitante deste empréstimo." }, 403);
      }

      if (emprestimo.status !== "Aprovado") {
        return json({ ok: false, erro: "Este empréstimo não está ativo." }, 409);
      }

      if (emprestimo.devolucao_solicitada_em) {
        return json({ ok: false, erro: "A devolução já foi solicitada." }, 409);
      }

      const resultado = await env.DB.prepare(`
        UPDATE emprestimos
        SET devolucao_solicitada_em = ?
        WHERE id = ?
          AND solicitante_id = ?
          AND status = 'Aprovado'
          AND devolucao_solicitada_em IS NULL
          AND EXISTS (
            SELECT 1
            FROM livros
            WHERE livros.id = emprestimos.livro_id
              AND livros.status = 'Emprestado'
          )
      `).bind(agora, id, user.user_id).run();

      if (!resultado.meta.changes) {
        return json({
          ok: false,
          erro: "Não foi possível registrar a solicitação de devolução."
        }, 409);
      }

      return json({
        ok: true,
        mensagem: "Devolução solicitada ao dono do livro."
      });
    }

    if (acao === "confirmar_devolucao") {
      if (emprestimo.dono_id !== user.user_id) {
        return json({ ok: false, erro: "Você não é o dono deste livro." }, 403);
      }

      if (
        emprestimo.status !== "Aprovado" ||
        !emprestimo.devolucao_solicitada_em
      ) {
        return json({
          ok: false,
          erro: "Não existe uma devolução pendente de confirmação."
        }, 409);
      }

      const resultado = await env.DB.batch([
        env.DB.prepare(`
          UPDATE emprestimos
          SET status = 'Devolvido', devolvido_em = ?
          WHERE id = ?
            AND status = 'Aprovado'
            AND devolucao_solicitada_em IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM livros
              WHERE livros.id = emprestimos.livro_id
                AND livros.dono_id = ?
                AND livros.status = 'Emprestado'
            )
        `).bind(agora, id, user.user_id),

        env.DB.prepare(`
          UPDATE livros
          SET status = 'Disponível'
          WHERE id = ?
            AND status = 'Emprestado'
            AND EXISTS (
              SELECT 1
              FROM emprestimos
              WHERE emprestimos.id = ?
                AND emprestimos.status = 'Devolvido'
                AND emprestimos.devolvido_em = ?
            )
        `).bind(emprestimo.livro_id, id, agora)
      ]);

      if (!resultado[0].meta.changes || !resultado[1].meta.changes) {
        return json({
          ok: false,
          erro: "Não foi possível confirmar a devolução."
        }, 409);
      }

      return json({
        ok: true,
        mensagem: "Devolução confirmada. O livro está disponível novamente."
      });
    }

    return json({ ok: false, erro: "Ação não reconhecida." }, 400);

  } catch (error) {
    console.error("Erro ao atualizar empréstimo:", error);
    return json({ ok: false, erro: "Erro interno ao atualizar empréstimo." }, 500);
  }
}
