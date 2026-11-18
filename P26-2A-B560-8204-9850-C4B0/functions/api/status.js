/**
 * Cloudflare Pages Function — `GET /api/status`
 *
 * Diagnóstico público do projeto: identifica a Chave Única, a conexão com o D1
 * e se o OAuth2 do Discord está configurado.
 *
 * Somente leitura: NUNCA cria tabelas em runtime (migrations são responsáveis
 * pelo esquema). Falha de D1 degrada para `d1Connected:false` sem derrubar o endpoint.
 *
 * @module functions/api/status
 */

import { fail, json } from "./_lib/http.js";

/** Chave Única oficial do projeto. */
const CHAVE = "P26-2A-B560-8204-9850-C4B0";

/** Identificador do projeto na avaliação. */
const PROJECT_ID = 28;

/** Título oficial do projeto. */
const PROJECT_TITLE = "Livro de Receitas Colaborativo com Escalonador de Porções";

/**
 * Conta receitas e usuários em um único batch (mínimo de round-trips).
 *
 * @param {Record<string, unknown>} env Bindings do Pages Functions.
 * @returns {Promise<{ connected: boolean, recipesCount: number, usersCount: number }>}
 */
async function readCounts(env) {
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return { connected: false, recipesCount: 0, usersCount: 0 };
  }

  try {
    const [recipesResult, usersResult] = await db.batch([
      db.prepare("SELECT COUNT(*) AS total FROM recipes"),
      db.prepare("SELECT COUNT(*) AS total FROM discord_users"),
    ]);

    const recipesCount = Number(recipesResult.results?.[0]?.total ?? 0);
    const usersCount = Number(usersResult.results?.[0]?.total ?? 0);

    return {
      connected: true,
      recipesCount: Number.isFinite(recipesCount) ? recipesCount : 0,
      usersCount: Number.isFinite(usersCount) ? usersCount : 0,
    };
  } catch {
    // Banco inexistente/migração pendente: reporta desconectado sem vazar detalhes.
    return { connected: false, recipesCount: 0, usersCount: 0 };
  }
}

/**
 * `GET /api/status`
 *
 * @param {{ env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Promise<Response>} JSON com o diagnóstico do projeto.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const counts = await readCounts(env);

  return json({
    ok: true,
    chave: CHAVE,
    projectId: PROJECT_ID,
    projectTitle: PROJECT_TITLE,
    d1Connected: counts.connected,
    discordOAuthConfigured: Boolean(env?.DISCORD_CLIENT_ID),
    recipesCount: counts.recipesCount,
    usersCount: counts.usersCount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Qualquer método diferente de GET → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
