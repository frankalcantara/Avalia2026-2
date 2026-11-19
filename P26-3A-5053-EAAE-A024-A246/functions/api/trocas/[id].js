
import { getSessionUser, json } from "../../_lib/session.js";

export async function onRequestPost({ request, env, params }) {
  try {
    if (!env.DB) {
      return json({ ok: false, erro: "Banco de dados indisponível." }, 503);
    }

    const usuario = await getSessionUser(request, env);

    if (!usuario) {
      return json({ ok: false, erro: "Faça login para continuar." }, 401);
    }

    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, erro: "Proposta inválida." }, 400);
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

    const acao = body.acao;

    if (!["aceitar", "recusar", "confirmar_conclusao"].includes(acao)) {
      return json({ ok: false, erro: "Ação inválida." }, 400);
    }

    const troca = await env.DB.prepare(`
      SELECT *
      FROM propostas_troca
      WHERE id = ?
    `).bind(id).first();

    if (!troca) {
      return json({ ok: false, erro: "Proposta não encontrada." }, 404);
    }

    const ehProponente = usuario.user_id === troca.proponente_id;
    const ehDono = usuario.user_id === troca.dono_alvo_id;

    if (!ehProponente && !ehDono) {
      return json({ ok: false, erro: "Acesso não autorizado." }, 403);
    }

    if (acao === "aceitar" || acao === "recusar") {
      if (!ehDono) {
        return json({
          ok: false,
          erro: "Somente o dono do livro desejado pode aceitar ou recusar."
        }, 403);
      }

      if (troca.status !== "Pendente") {
        return json({
          ok: false,
          erro: "Esta proposta não está mais pendente."
        }, 409);
      }

      const novoStatus = acao === "aceitar" ? "Aceita" : "Recusada";

      const resultado = await env.DB.prepare(`
        UPDATE propostas_troca
        SET status = ?,
            decidida_em = datetime('now')
        WHERE id = ?
          AND status = 'Pendente'
      `).bind(novoStatus, id).run();

      if (resultado.meta.changes !== 1) {
        return json({
          ok: false,
          erro: "A proposta foi alterada. Atualize a página."
        }, 409);
      }

      return json({
        ok: true,
        mensagem: acao === "aceitar"
          ? "Proposta aceita!"
          : "Proposta recusada."
      });
    }

    if (acao === "confirmar_conclusao") {
      if (troca.status !== "Aceita") {
        return json({
          ok: false,
          erro: "A proposta precisa estar aceita."
        }, 409);
      }

      const coluna = ehProponente
        ? "confirmada_proponente_em"
        : "confirmada_dono_em";

      await env.DB.prepare(`
        UPDATE propostas_troca
        SET ${coluna} = COALESCE(${coluna}, datetime('now'))
        WHERE id = ?
          AND status = 'Aceita'
      `).bind(id).run();

      const atualizada = await env.DB.prepare(`
        SELECT
          confirmada_proponente_em,
          confirmada_dono_em
        FROM propostas_troca
        WHERE id = ?
      `).bind(id).first();

      if (
        !atualizada.confirmada_proponente_em ||
        !atualizada.confirmada_dono_em
      ) {
        return json({
          ok: true,
          concluida: false,
          mensagem: "Sua confirmação foi registrada. Falta a confirmação da outra pessoa."
        });
      }

      const finalizacao = await env.DB.prepare(`
        UPDATE propostas_troca
        SET status = 'Concluida',
            concluida_em = datetime('now')
        WHERE id = ?
          AND status = 'Aceita'
          AND confirmada_proponente_em IS NOT NULL
          AND confirmada_dono_em IS NOT NULL
      `).bind(id).run();

      if (finalizacao.meta.changes !== 1) {
        const verificacao = await env.DB.prepare(`
          SELECT status
          FROM propostas_troca
          WHERE id = ?
        `).bind(id).first();

        if (verificacao?.status === "Concluida") {
          return json({
            ok: true,
            concluida: true,
            mensagem: "Troca concluída!"
          });
        }

        return json({
          ok: false,
          erro: "Não foi possível concluir. Confira se os dois livros continuam reservados."
        }, 409);
      }

      return json({
        ok: true,
        concluida: true,
        mensagem: "Troca concluída! Os livros foram transferidos para os novos donos."
      });
    }

  } catch (error) {
    console.error("Erro ao processar proposta de troca:", error);

    return json({
      ok: false,
      erro: "Não foi possível processar a proposta. Verifique se os livros continuam reservados."
    }, 500);
  }
}
