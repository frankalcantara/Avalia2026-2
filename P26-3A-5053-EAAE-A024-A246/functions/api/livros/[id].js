import { getSessionUser, json } from "../../_lib/session.js";

export async function onRequestPost({ request, env, params }) {
  try {
    if (!env.DB) {
      return json({ ok: false, error: "Banco de dados indisponível." }, 503);
    }

    const user = await getSessionUser(request, env);

    if (!user) {
      return json({ ok: false, error: "Faça login com Discord." }, 401);
    }

    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Livro inválido." }, 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Dados enviados em formato inválido." }, 400);
    }

    if (!["retirar", "reativar"].includes(body.acao)) {
      return json({ ok: false, error: "Ação inválida." }, 400);
    }

    const livro = await env.DB.prepare(`
      SELECT id, dono_id, catalogo_ativo
      FROM livros
      WHERE id = ?
    `).bind(id).first();

    if (!livro) {
      return json({ ok: false, error: "Livro não encontrado." }, 404);
    }

    if (livro.dono_id !== user.user_id) {
      return json({ ok: false, error: "Você não é o dono deste livro." }, 403);
    }

    if (body.acao === "retirar") {
      if (livro.catalogo_ativo === 0) {
        return json({ ok: false, error: "Este livro já foi retirado do catálogo." }, 400);
      }

      const resultado = await env.DB.prepare(`
        UPDATE livros
        SET catalogo_ativo = 0
        WHERE id = ?
          AND dono_id = ?
          AND catalogo_ativo = 1
          AND status = 'Disponível'
          AND NOT EXISTS (
            SELECT 1 FROM emprestimos
            WHERE livro_id = livros.id
              AND status IN ('Pendente', 'Aprovado')
          )
          AND NOT EXISTS (
            SELECT 1 FROM propostas_troca
            WHERE (livro_alvo_id = livros.id OR livro_ofertado_id = livros.id)
              AND status IN ('Pendente', 'Aceita')
          )
      `).bind(id, user.user_id).run();

      if (resultado.meta.changes !== 1) {
        return json({
          ok: false,
          error: "Não é possível retirar este livro. Ele pode estar reservado, emprestado ou em uma negociação ativa."
        }, 409);
      }

      return json({ ok: true, message: "Livro retirado do catálogo." });
    }

    const resultado = await env.DB.prepare(`
      UPDATE livros
      SET catalogo_ativo = 1
      WHERE id = ?
        AND dono_id = ?
        AND catalogo_ativo = 0
        AND status = 'Disponível'
    `).bind(id, user.user_id).run();

    if (resultado.meta.changes !== 1) {
      return json({
        ok: false,
        error: "Não é possível recolocar este livro no catálogo."
      }, 409);
    }

    return json({ ok: true, message: "Livro recolocado no catálogo." });
  } catch (error) {
    console.error("Erro ao atualizar livro no catálogo.");
    return json({ ok: false, error: "Não foi possível atualizar o livro." }, 500);
  }
}