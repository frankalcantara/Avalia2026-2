/**
 * Cloudflare Pages Function — /api/cards
 *
 * GET  /api/cards  → lista os cartões do usuário logado (coluna, posição).
 * POST /api/cards  → cria um cartão no fim da coluna escolhida.
 *
 * Segurança:
 * - O user_id vem SEMPRE da sessão Discord (cookie HttpOnly), nunca do cliente.
 * - Todas as consultas filtram por user_id e usam .prepare().bind().
 */

import {
  COLUNAS_VALIDAS,
  cartaoParaJson,
  erro,
  erroBancoIndisponivel,
  erroMetodoNaoPermitido,
  erroNaoAutenticado,
  json,
  lerCorpoJson,
  validarColuna,
  validarPosicao,
  validarPrioridade,
  validarTitulo,
} from "../_lib/kanban.js";
import { lerSessao } from "../_lib/session.js";

export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    const sessao = await lerSessao(request, env);
    if (!sessao) return erroNaoAutenticado();

    const banco = env && env.DB ? env.DB : null;
    if (!banco) return erroBancoIndisponivel();

    const resultado = await banco
      .prepare(
        "SELECT id, titulo, prioridade, coluna, posicao, criado_em, atualizado_em FROM cards WHERE user_id = ? ORDER BY coluna ASC, posicao ASC, id ASC"
      )
      .bind(sessao.userId)
      .all();

    const cartoes = (resultado.results || []).map(cartaoParaJson);

    return json({ ok: true, total: cartoes.length, cards: cartoes }, 200);
  } catch (falha) {
    console.error("Falha ao listar cartões:", falha);
    return erro(500, "internal_error", "Erro interno ao listar os cartões.");
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const sessao = await lerSessao(request, env);
    if (!sessao) return erroNaoAutenticado();

    const banco = env && env.DB ? env.DB : null;
    if (!banco) return erroBancoIndisponivel();

    const corpoResultado = await lerCorpoJson(request);
    if (corpoResultado.erro) {
      return erro(400, "invalid_body", corpoResultado.erro);
    }
    const corpo = corpoResultado.valor;

    const tituloResultado = validarTitulo(corpo.titulo);
    if (tituloResultado.erro) {
      return erro(400, "invalid_titulo", tituloResultado.erro);
    }

    const prioridadeResultado = Object.prototype.hasOwnProperty.call(
      corpo,
      "prioridade"
    )
      ? validarPrioridade(corpo.prioridade)
      : { valor: "media" };
    if (prioridadeResultado.erro) {
      return erro(400, "invalid_prioridade", prioridadeResultado.erro);
    }

    const colunaResultado = Object.prototype.hasOwnProperty.call(
      corpo,
      "coluna"
    )
      ? validarColuna(corpo.coluna)
      : { valor: COLUNAS_VALIDAS[0] };
    if (colunaResultado.erro) {
      return erro(400, "invalid_coluna", colunaResultado.erro);
    }

    // posicao enviada pelo cliente é apenas validada; o cartão sempre entra no
    // fim da coluna para manter o quadro consistente.
    if (Object.prototype.hasOwnProperty.call(corpo, "posicao")) {
      const posicaoResultado = validarPosicao(corpo.posicao);
      if (posicaoResultado.erro) {
        return erro(400, "invalid_posicao", posicaoResultado.erro);
      }
    }

    const coluna = colunaResultado.valor;

    // A subconsulta calcula a próxima posição no próprio INSERT, evitando que
    // duas requisições concorrentes escolham a mesma posição.
    const insercao = await banco
      .prepare(
        "INSERT INTO cards (user_id, titulo, prioridade, coluna, posicao) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(posicao), -1) + 1 FROM cards WHERE user_id = ? AND coluna = ?))"
      )
      .bind(
        sessao.userId,
        tituloResultado.valor,
        prioridadeResultado.valor,
        coluna,
        sessao.userId,
        coluna
      )
      .run();

    const id = Number(insercao.meta && insercao.meta.last_row_id);
    if (!id) {
      return erro(
        500,
        "insert_failed",
        "Não foi possível criar o cartão no banco de dados."
      );
    }

    const cartao = await banco
      .prepare(
        "SELECT id, titulo, prioridade, coluna, posicao, criado_em, atualizado_em FROM cards WHERE id = ? AND user_id = ?"
      )
      .bind(id, sessao.userId)
      .first();

    if (!cartao) {
      return erro(
        500,
        "insert_failed",
        "O cartão foi inserido, mas não pôde ser lido de volta."
      );
    }

    return json({ ok: true, card: cartaoParaJson(cartao) }, 201);
  } catch (falha) {
    console.error("Falha ao criar cartão:", falha);
    return erro(500, "internal_error", "Erro interno ao criar o cartão.");
  }
}

export function onRequest() {
  return erroMetodoNaoPermitido();
}
