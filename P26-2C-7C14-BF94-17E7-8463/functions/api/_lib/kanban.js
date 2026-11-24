/**
 * Helpers compartilhados das rotas /api/cards (Cloudflare Pages Functions + D1).
 *
 * Este arquivo NÃO exporta nenhum handler `onRequest*`, portanto o roteador
 * de Pages Functions não cria nenhuma rota para ele. Ele é apenas importado
 * pelos handlers de cartões.
 *
 * Sessão: lida exclusivamente via `lerSessao` de `_lib/session.js`, que valida
 * a assinatura HMAC-SHA256 do cookie "discord_session". Nenhuma leitura direta
 * do cookie é feita aqui.
 */

import { lerSessao } from "./session.js";

export const COLUNAS_VALIDAS = ["a-fazer", "em-execucao", "concluido"];
export const PRIORIDADES_VALIDAS = ["baixa", "media", "alta"];
export const TITULO_MAX_CARACTERES = 120;

/** Resposta JSON padrão (sempre sem cache). */
export function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Resposta de erro padronizada: { ok, error, message }. */
export function erro(status, codigo, mensagem) {
  return json({ ok: false, error: codigo, message: mensagem }, status);
}

export function erroNaoAutenticado() {
  return erro(
    401,
    "unauthorized",
    "Sessão inválida ou ausente. Faça login com o Discord para acessar seus cartões."
  );
}

export function erroMetodoNaoPermitido() {
  return erro(405, "method_not_allowed", "Método não permitido para esta rota.");
}

export function erroBancoIndisponivel() {
  return erro(
    500,
    "database_unavailable",
    "O banco de dados D1 não está disponível neste ambiente."
  );
}

/** Normaliza o :id da rota. Aceita apenas inteiro positivo (string ou número). */
export function normalizarId(valor) {
  if (typeof valor === "number") {
    return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
  }

  if (typeof valor === "string") {
    const texto = valor.trim();
    if (!/^[1-9]\d*$/.test(texto)) return null;
    const numero = Number(texto);
    return Number.isSafeInteger(numero) ? numero : null;
  }

  return null;
}

export async function lerCorpoJson(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return { erro: "O corpo da requisição deve ser um JSON válido." };
  }

  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return { erro: "O corpo da requisição deve ser um objeto JSON." };
  }

  return { valor: corpo };
}

export function validarTitulo(valor) {
  if (typeof valor !== "string") {
    return { erro: "O campo 'titulo' deve ser um texto." };
  }

  const titulo = valor.trim();
  if (!titulo) {
    return { erro: "O campo 'titulo' não pode ser vazio." };
  }
  if (titulo.length > TITULO_MAX_CARACTERES) {
    return {
      erro: `O campo 'titulo' deve ter no máximo ${TITULO_MAX_CARACTERES} caracteres.`,
    };
  }

  return { valor: titulo };
}

export function validarPrioridade(valor) {
  if (typeof valor !== "string" || !PRIORIDADES_VALIDAS.includes(valor)) {
    return {
      erro: "O campo 'prioridade' deve ser um destes valores: baixa, media ou alta.",
    };
  }
  return { valor };
}

export function validarColuna(valor) {
  if (typeof valor !== "string" || !COLUNAS_VALIDAS.includes(valor)) {
    return {
      erro: "O campo 'coluna' deve ser um destes valores: a-fazer, em-execucao ou concluido.",
    };
  }
  return { valor };
}

export function validarPosicao(valor) {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0) {
    return { erro: "O campo 'posicao' deve ser um inteiro maior ou igual a 0." };
  }
  return { valor };
}

/** Converte uma linha da tabela cards no formato público da API. */
export function cartaoParaJson(linha) {
  return {
    id: Number(linha.id),
    titulo: linha.titulo,
    prioridade: linha.prioridade,
    coluna: linha.coluna,
    posicao: Number(linha.posicao),
    criado_em: linha.criado_em,
    atualizado_em: linha.atualizado_em,
  };
}

/** Busca um cartão SEMPRE filtrando pelo dono (id + user_id). */
export async function buscarCartao(banco, userId, id) {
  return banco
    .prepare(
      "SELECT id, titulo, prioridade, coluna, posicao, criado_em, atualizado_em FROM cards WHERE id = ? AND user_id = ?"
    )
    .bind(id, userId)
    .first();
}

/** Lista os cartões de uma coluna do usuário, exceto um id, ordenados por posição. */
export async function listarColuna(banco, userId, coluna, idExcluido = -1) {
  const resultado = await banco
    .prepare(
      "SELECT id, posicao FROM cards WHERE user_id = ? AND coluna = ? AND id <> ? ORDER BY posicao ASC, id ASC"
    )
    .bind(userId, coluna, idExcluido)
    .all();

  return resultado.results || [];
}

/**
 * Monta (sem executar) as instruções que colocam o cartão na coluna/posição
 * desejadas e renumeram as colunas afetadas. Quem chama executa tudo em
 * `env.DB.batch(...)` para que a movimentação seja atômica.
 */
export async function montarMovimentacao(
  banco,
  userId,
  cartao,
  colunaDestino,
  posicaoPedida,
  campos
) {
  const cartoesDestino = await listarColuna(
    banco,
    userId,
    colunaDestino,
    cartao.id
  );

  const indice =
    posicaoPedida === null || posicaoPedida === undefined
      ? cartoesDestino.length
      : Math.max(0, Math.min(posicaoPedida, cartoesDestino.length));

  const ordemDestino = cartoesDestino.slice();
  ordemDestino.splice(indice, 0, { id: cartao.id, posicao: null });

  const statements = [];

  ordemDestino.forEach((item, novaPosicao) => {
    if (item.id === cartao.id) {
      statements.push(
        banco
          .prepare(
            "UPDATE cards SET titulo = ?, prioridade = ?, coluna = ?, posicao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
          )
          .bind(
            campos.titulo,
            campos.prioridade,
            colunaDestino,
            novaPosicao,
            cartao.id,
            userId
          )
      );
      return;
    }

    if (Number(item.posicao) !== novaPosicao) {
      statements.push(
        banco
          .prepare(
            "UPDATE cards SET posicao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
          )
          .bind(novaPosicao, item.id, userId)
      );
    }
  });

  if (colunaDestino !== cartao.coluna) {
    const restantesOrigem = await listarColuna(
      banco,
      userId,
      cartao.coluna,
      cartao.id
    );

    restantesOrigem.forEach((item, novaPosicao) => {
      if (Number(item.posicao) !== novaPosicao) {
        statements.push(
          banco
            .prepare(
              "UPDATE cards SET posicao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
            )
            .bind(novaPosicao, item.id, userId)
        );
      }
    });
  }

  return { statements, indice, coluna: colunaDestino };
}

/** Monta as instruções que fecham os buracos de posição em uma coluna. */
export async function montarRenumeracao(banco, userId, coluna) {
  const cartoes = await listarColuna(banco, userId, coluna, -1);
  const statements = [];

  cartoes.forEach((item, novaPosicao) => {
    if (Number(item.posicao) !== novaPosicao) {
      statements.push(
        banco
          .prepare(
            "UPDATE cards SET posicao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
          )
          .bind(novaPosicao, item.id, userId)
      );
    }
  });

  return statements;
}

/**
 * Implementação compartilhada de PATCH (parcial) e PUT (substituição dos
 * campos editáveis). O user_id nunca é lido do corpo/URL: apenas da sessão.
 */
export async function atualizarCartao(context, exigirCamposCompletos) {
  const { request, env, params } = context;

  const sessao = await lerSessao(request, env);
  if (!sessao) return erroNaoAutenticado();

  const banco = env && env.DB ? env.DB : null;
  if (!banco) return erroBancoIndisponivel();

  const id = normalizarId(params && params.id);
  if (id === null) {
    return erro(
      400,
      "invalid_id",
      "O id do cartão deve ser um inteiro positivo."
    );
  }

  const corpoResultado = await lerCorpoJson(request);
  if (corpoResultado.erro) {
    return erro(400, "invalid_body", corpoResultado.erro);
  }
  const corpo = corpoResultado.valor;

  const atual = await buscarCartao(banco, sessao.userId, id);
  if (!atual) {
    return erro(404, "card_not_found", "Cartão não encontrado.");
  }

  const camposPresentes = ["titulo", "prioridade", "coluna", "posicao"].filter(
    (campo) => Object.prototype.hasOwnProperty.call(corpo, campo)
  );

  if (exigirCamposCompletos) {
    const faltando = ["titulo", "prioridade"].filter(
      (campo) => !camposPresentes.includes(campo)
    );
    if (faltando.length > 0) {
      return erro(
        400,
        "missing_fields",
        `O corpo do PUT deve conter: ${faltando.join(", ")}.`
      );
    }
  }

  if (camposPresentes.length === 0) {
    return erro(
      400,
      "no_fields",
      "Informe ao menos um campo editável: titulo, prioridade, coluna ou posicao."
    );
  }

  const alteracoes = {};

  if (Object.prototype.hasOwnProperty.call(corpo, "titulo")) {
    const resultado = validarTitulo(corpo.titulo);
    if (resultado.erro) return erro(400, "invalid_titulo", resultado.erro);
    alteracoes.titulo = resultado.valor;
  }

  if (Object.prototype.hasOwnProperty.call(corpo, "prioridade")) {
    const resultado = validarPrioridade(corpo.prioridade);
    if (resultado.erro) return erro(400, "invalid_prioridade", resultado.erro);
    alteracoes.prioridade = resultado.valor;
  }

  if (Object.prototype.hasOwnProperty.call(corpo, "coluna")) {
    const resultado = validarColuna(corpo.coluna);
    if (resultado.erro) return erro(400, "invalid_coluna", resultado.erro);
    alteracoes.coluna = resultado.valor;
  }

  if (Object.prototype.hasOwnProperty.call(corpo, "posicao")) {
    const resultado = validarPosicao(corpo.posicao);
    if (resultado.erro) return erro(400, "invalid_posicao", resultado.erro);
    alteracoes.posicao = resultado.valor;
  }

  const tituloFinal =
    alteracoes.titulo !== undefined ? alteracoes.titulo : atual.titulo;
  const prioridadeFinal =
    alteracoes.prioridade !== undefined
      ? alteracoes.prioridade
      : atual.prioridade;
  const colunaDestino =
    alteracoes.coluna !== undefined ? alteracoes.coluna : atual.coluna;
  const mudouDeColuna = colunaDestino !== atual.coluna;
  const posicaoInformada = alteracoes.posicao !== undefined;

  if (mudouDeColuna || posicaoInformada) {
    const movimentacao = await montarMovimentacao(
      banco,
      sessao.userId,
      { id, coluna: atual.coluna, posicao: atual.posicao },
      colunaDestino,
      posicaoInformada ? alteracoes.posicao : null,
      { titulo: tituloFinal, prioridade: prioridadeFinal }
    );

    if (movimentacao.statements.length > 0) {
      await banco.batch(movimentacao.statements);
    }
  } else {
    const resultado = await banco
      .prepare(
        "UPDATE cards SET titulo = ?, prioridade = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
      )
      .bind(tituloFinal, prioridadeFinal, id, sessao.userId)
      .run();

    if (!Number(resultado.meta && resultado.meta.changes)) {
      return erro(404, "card_not_found", "Cartão não encontrado.");
    }
  }

  const atualizado = await buscarCartao(banco, sessao.userId, id);
  if (!atualizado) {
    return erro(404, "card_not_found", "Cartão não encontrado.");
  }

  return json({ ok: true, card: cartaoParaJson(atualizado) }, 200);
}
