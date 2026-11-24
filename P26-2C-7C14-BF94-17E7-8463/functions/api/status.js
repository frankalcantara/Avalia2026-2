/**
 * Cloudflare Pages Function — /api/status
 *
 * Diagnóstico do projeto e dos "pings" de sessão.
 *
 * Segurança:
 * - GET anônimo devolve apenas dados públicos do projeto (nenhum registro).
 * - GET autenticado devolve os dados do usuário e SOMENTE os registros cujo
 *   user_id é o da sessão assinada (WHERE user_id = ?, limite 10).
 * - POST exige sessão; user_id e username vêm SEMPRE da sessão, nunca do corpo.
 * - Todas as respostas usam `Cache-Control: no-store` (helper `json`).
 * - Nenhum CREATE TABLE em tempo de execução: a tabela project_records já é
 *   criada por migrations/0001_init.sql.
 */

import {
  erro,
  erroBancoIndisponivel,
  erroMetodoNaoPermitido,
  erroNaoAutenticado,
  json,
  lerCorpoJson,
} from "./_lib/kanban.js";
import { lerSessao } from "./_lib/session.js";

const CHAVE = "P26-2C-7C14-BF94-17E7-8463";
const PROJECT_ID = 9;
const PROJECT_TITLE = "Quadro Kanban Pessoal";
const CONTEUDO_MAX_CARACTERES = 200;
const REGISTROS_LIMITE = 10;

/** Valida o campo `conteudo` do POST (texto, trim, não vazio, até 200). */
function validarConteudo(valor) {
  if (typeof valor !== "string") {
    return { erro: "O campo 'conteudo' deve ser um texto." };
  }

  const conteudo = valor.trim();
  if (!conteudo) {
    return { erro: "O campo 'conteudo' não pode ser vazio." };
  }
  if (conteudo.length > CONTEUDO_MAX_CARACTERES) {
    return {
      erro: `O campo 'conteudo' deve ter no máximo ${CONTEUDO_MAX_CARACTERES} caracteres.`,
    };
  }

  return { valor: conteudo };
}

/** Confere apenas a conectividade com o D1, sem ler registros de usuários. */
async function bancoConectado(env) {
  if (!env || !env.DB) return false;
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return true;
  } catch {
    return false;
  }
}

/** Projeção pública da sessão (nunca inclui o cookie nem a assinatura). */
function sessaoPublica(sessao) {
  if (!sessao) return null;
  return {
    userId: sessao.userId,
    username: sessao.username,
    avatar: sessao.avatar,
  };
}

async function responderGet(env, sessao) {
  const conectado = await bancoConectado(env);

  const corpo = {
    ok: true,
    chave: CHAVE,
    projectId: PROJECT_ID,
    projectTitle: PROJECT_TITLE,
    d1Connected: conectado,
    discordOAuthConfigured: Boolean(env && env.DISCORD_CLIENT_ID),
    sessionUser: sessaoPublica(sessao),
    serverTimestamp: new Date().toISOString(),
  };

  // Sem sessão: nenhum registro de project_records é consultado ou devolvido.
  if (sessao && conectado) {
    try {
      const totalRow = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM project_records WHERE user_id = ?"
      )
        .bind(sessao.userId)
        .first();

      const lista = await env.DB.prepare(
        "SELECT id, user_id, username, conteudo, created_at FROM project_records WHERE user_id = ? ORDER BY id DESC LIMIT 10"
      )
        .bind(sessao.userId)
        .all();

      corpo.totalRegistros = Number(totalRow?.total || 0);
      corpo.ultimosRegistros = lista.results || [];
    } catch (falha) {
      console.error("Falha ao ler os registros do usuário:", falha);
      corpo.d1Connected = false;
      corpo.totalRegistros = 0;
      corpo.ultimosRegistros = [];
    }
  }

  return json(corpo, 200);
}

async function responderPost(env, sessao, request) {
  // Escrita exige sessão válida; sem ela, 401 antes de qualquer leitura do corpo.
  if (!sessao) return erroNaoAutenticado();

  if (!env || !env.DB) return erroBancoIndisponivel();

  const corpoResultado = await lerCorpoJson(request);
  if (corpoResultado.erro) {
    return erro(400, "invalid_body", corpoResultado.erro);
  }

  const conteudoResultado = validarConteudo(corpoResultado.valor.conteudo);
  if (conteudoResultado.erro) {
    return erro(400, "invalid_conteudo", conteudoResultado.erro);
  }

  try {
    await env.DB.prepare(
      "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
    )
      .bind(
        sessao.userId,
        sessao.username,
        CHAVE,
        conteudoResultado.valor
      )
      .run();
  } catch (falha) {
    console.error("Falha ao registrar status:", falha);
    return erro(500, "internal_error", "Erro interno ao registrar o status.");
  }

  return json(
    {
      ok: true,
      saved: true,
      chave: CHAVE,
      serverTimestamp: new Date().toISOString(),
    },
    201
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const sessao = await lerSessao(request, env);

  if (request.method === "GET") {
    return responderGet(env, sessao);
  }

  if (request.method === "POST") {
    return responderPost(env, sessao, request);
  }

  return erroMetodoNaoPermitido();
}
