/**
 * Cloudflare Pages Function — /api/cards/:id
 *
 * PATCH  /api/cards/:id → atualiza parcialmente titulo, prioridade, coluna e/ou posicao.
 * PUT    /api/cards/:id → substitui os campos editáveis (titulo e prioridade obrigatórios).
 * DELETE /api/cards/:id → apaga o cartão do usuário logado.
 *
 * Segurança:
 * - O user_id vem SEMPRE da sessão Discord (cookie HttpOnly), nunca do cliente.
 * - UPDATE/DELETE usam WHERE id = ? AND user_id = ?; cartão de outro usuário
 *   responde 404 (sem revelar que existe).
 * - Movimentações usam env.DB.batch(...) para serem atômicas.
 */

import {
  atualizarCartao,
  buscarCartao,
  cartaoParaJson,
  erro,
  erroBancoIndisponivel,
  erroMetodoNaoPermitido,
  erroNaoAutenticado,
  json,
  montarRenumeracao,
  normalizarId,
} from "../_lib/kanban.js";
import { lerSessao } from "../_lib/session.js";

async function obterContexto(context) {
  const { request, env, params } = context;

  const sessao = await lerSessao(request, env);
  if (!sessao) return { erro: erroNaoAutenticado() };

  const banco = env && env.DB ? env.DB : null;
  if (!banco) return { erro: erroBancoIndisponivel() };

  const id = normalizarId(params && params.id);
  if (id === null) {
    return {
      erro: erro(
        400,
        "invalid_id",
        "O id do cartão deve ser um inteiro positivo."
      ),
    };
  }

  return { request, banco, sessao, id };
}

export async function onRequestPatch(context) {
  try {
    return await atualizarCartao(context, false);
  } catch (falha) {
    console.error("Falha ao atualizar cartão (PATCH):", falha);
    return erro(500, "internal_error", "Erro interno ao atualizar o cartão.");
  }
}

export async function onRequestPut(context) {
  try {
    return await atualizarCartao(context, true);
  } catch (falha) {
    console.error("Falha ao atualizar cartão (PUT):", falha);
    return erro(500, "internal_error", "Erro interno ao atualizar o cartão.");
  }
}

export async function onRequestDelete(context) {
  try {
    const preparado = await obterContexto(context);
    if (preparado.erro) return preparado.erro;

    const { banco, sessao, id } = preparado;

    const cartao = await buscarCartao(banco, sessao.userId, id);
    if (!cartao) {
      return erro(404, "card_not_found", "Cartão não encontrado.");
    }

    const remocao = await banco
      .prepare("DELETE FROM cards WHERE id = ? AND user_id = ?")
      .bind(id, sessao.userId)
      .run();

    if (!Number(remocao.meta && remocao.meta.changes)) {
      return erro(404, "card_not_found", "Cartão não encontrado.");
    }

    // Fecha os buracos de posição deixados na coluna, também de forma atômica.
    const statements = await montarRenumeracao(
      banco,
      sessao.userId,
      cartao.coluna
    );
    if (statements.length > 0) {
      await banco.batch(statements);
    }

    return json(
      {
        ok: true,
        deleted_id: id,
        card: cartaoParaJson(cartao),
      },
      200
    );
  } catch (falha) {
    console.error("Falha ao apagar cartão:", falha);
    return erro(500, "internal_error", "Erro interno ao apagar o cartão.");
  }
}

export function onRequest() {
  return erroMetodoNaoPermitido();
}
