/**
 * Cloudflare Pages Function — `/api/recipes`
 *
 *  * `GET`  → listagem pública com busca por título/ingrediente, tempo máximo,
 *             escopo (`all` | `mine` | `favorites`) e paginação limitada.
 *  * `POST` → criação autenticada (validação server-side + batch no D1).
 *
 * Todas as consultas são parametrizadas com `prepare(...).bind(...)`.
 *
 * @module functions/api/recipes/index
 */

import { fail, failFromError, json, readJson } from "../_lib/http.js";
import { loadRecipeDetail, mapRecipeSummary } from "../_lib/d1.js";
import { getSessionUser } from "../_lib/session.js";
import { RECIPE_LIMITS, validateRecipe } from "../_lib/validate.js";

/**
 * Tamanho máximo dos termos de busca aceitos (em code points).
 *
 * O truncamento real e efetivo acontece em `likePattern`, que conta **bytes
 * UTF-8**: o SQLite usado pelo D1 aborta a consulta com
 * `LIKE or GLOB pattern too complex` quando o padrão compilado passa de 50
 * bytes. Antes deste limite, um termo de 64 caracteres (ou ~16 emojis)
 * derrubava `GET /api/recipes` em HTTP 500 — negação de serviço trivial com
 * entrada pública e não autenticada.
 */
const MAX_TERM_LENGTH = 48;

/** Limite empírico (verificado no D1 local) do padrão `LIKE` compilado, em bytes UTF-8. */
const MAX_LIKE_PATTERN_LENGTH = 50;

/** Corpo útil do padrão, descontando os dois `%` das pontas. */
const MAX_LIKE_BODY_LENGTH = MAX_LIKE_PATTERN_LENGTH - 2;

/** Limite padrão de itens por página. */
const DEFAULT_LIMIT = 20;

/** Limite máximo de itens por página. */
const MAX_LIMIT = 50;

/** Escopos aceitos na listagem. */
const SCOPES = new Set(["all", "mine", "favorites"]);

/**
 * Normaliza um termo de busca (colapsa espaços e corta em `MAX_TERM_LENGTH`).
 *
 * O corte é feito por *code point* para nunca produzir um par substituto
 * solto (emoji truncado ao meio).
 *
 * @param {string | null} raw Valor bruto do query string.
 * @returns {string} Termo normalizado.
 */
function normalizeTerm(raw) {
  if (typeof raw !== "string") return "";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_TERM_LENGTH) return collapsed;
  return Array.from(collapsed).slice(0, MAX_TERM_LENGTH).join("");
}

/**
 * Converte um termo em padrão LIKE, escapando `%`, `_` e `\`.
 *
 * O corpo é montado por *code point* e medido em **bytes UTF-8**, garantindo
 * que o padrão final nunca ultrapasse `MAX_LIKE_PATTERN_LENGTH` (limite do
 * compilador de LIKE do SQLite/D1), nunca parta um par substituto e nunca
 * deixe um `\` de escape solto.
 *
 * @param {string} term Termo já normalizado.
 * @returns {string} Padrão `%termo%` seguro para `LIKE ? ESCAPE '\'`.
 */
function likePattern(term) {
  const encoder = new TextEncoder();
  let body = "";
  let bodyBytes = 0;

  for (const char of term) {
    const escaped = char === "\\" || char === "%" || char === "_" ? `\\${char}` : char;
    const size = encoder.encode(escaped).length;
    if (bodyBytes + size > MAX_LIKE_BODY_LENGTH) break;
    body += escaped;
    bodyBytes += size;
  }

  return `%${body}%`;
}

/**
 * Interpreta inteiro de query string com clamp de faixa.
 *
 * @param {string | null} raw Valor bruto.
 * @param {number} fallback Valor padrão.
 * @param {number} min Mínimo.
 * @param {number} max Máximo.
 * @returns {number} Inteiro dentro da faixa.
 */
function readBoundedInt(raw, fallback, min, max) {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  if (!/^\d{1,9}$/.test(raw.trim())) return fallback;
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * `GET /api/recipes`
 *
 * @param {{ request: Request, env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Promise<Response>} Lista paginada de receitas.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const url = new URL(request.url);
  const query = normalizeTerm(url.searchParams.get("q"));
  const ingredient = normalizeTerm(url.searchParams.get("ingredient"));
  const scope = url.searchParams.get("scope") ?? "all";

  if (!SCOPES.has(scope)) {
    return fail(400, "invalid_query", "Parâmetro 'scope' deve ser 'all', 'mine' ou 'favorites'.");
  }

  let maxTime = null;
  const rawMaxTime = url.searchParams.get("maxTime");
  if (typeof rawMaxTime === "string" && rawMaxTime.trim() !== "") {
    if (!/^\d{1,4}$/.test(rawMaxTime.trim())) {
      return fail(400, "invalid_query", "Parâmetro 'maxTime' deve ser um inteiro entre 1 e 1440.");
    }
    maxTime = Number(rawMaxTime.trim());
    if (maxTime < 1 || maxTime > RECIPE_LIMITS.prepMinutesMax) {
      return fail(400, "invalid_query", "Parâmetro 'maxTime' deve ser um inteiro entre 1 e 1440.");
    }
  }

  const limit = readBoundedInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = readBoundedInt(url.searchParams.get("offset"), 0, 0, 1000000);

  const viewer = await getSessionUser(request, env);
  if ((scope === "mine" || scope === "favorites") && !viewer) {
    return fail(401, "auth_required", "Faça login para listar suas receitas ou favoritos.");
  }
  const viewerId = viewer?.userId ?? "";

  /** @type {string[]} */
  const conditions = [];
  /** @type {Array<string | number>} */
  const whereParams = [];

  if (query) {
    conditions.push("LOWER(r.title) LIKE ? ESCAPE '\\'");
    whereParams.push(likePattern(query));
  }
  if (ingredient) {
    conditions.push(
      "EXISTS (SELECT 1 FROM recipe_ingredients i WHERE i.recipe_id = r.id AND LOWER(i.name) LIKE ? ESCAPE '\\')",
    );
    whereParams.push(likePattern(ingredient));
  }
  if (maxTime !== null) {
    conditions.push("r.prep_minutes <= ?");
    whereParams.push(maxTime);
  }
  if (scope === "mine") {
    conditions.push("r.user_id = ?");
    whereParams.push(viewerId);
  }
  if (scope === "favorites") {
    conditions.push("EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = ?)");
    whereParams.push(viewerId);
  }

  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1 = 1";

  const countSql = `SELECT COUNT(*) AS total FROM recipes r WHERE ${whereClause}`;

  const listSql = `
    SELECT
      r.id AS id,
      r.title AS title,
      r.description AS description,
      r.prep_minutes AS prep_minutes,
      r.base_servings AS base_servings,
      r.created_at AS created_at,
      u.user_id AS author_user_id,
      u.username AS author_username,
      u.avatar AS author_avatar,
      (SELECT COUNT(*) FROM recipe_ingredients i WHERE i.recipe_id = r.id) AS ingredient_count,
      EXISTS (SELECT 1 FROM favorites f2 WHERE f2.recipe_id = r.id AND f2.user_id = ?) AS is_favorite
    FROM recipes r
    JOIN discord_users u ON u.user_id = r.user_id
    WHERE ${whereClause}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const [countResult, listResult] = await db.batch([
      db.prepare(countSql).bind(...whereParams),
      db.prepare(listSql).bind(viewerId, ...whereParams, limit, offset),
    ]);

    const total = Number(countResult.results?.[0]?.total ?? 0);

    return json({
      ok: true,
      total: Number.isFinite(total) ? total : 0,
      limit,
      offset,
      items: (listResult.results ?? []).map(mapRecipeSummary),
    });
  } catch {
    console.error("Falha ao listar receitas no D1.");
    return fail(500, "query_failed", "Não foi possível listar as receitas.");
  }
}

/**
 * `POST /api/recipes`
 *
 * @param {{ request: Request, env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Promise<Response>} 201 com a receita completa criada.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const viewer = await getSessionUser(request, env);
  if (!viewer) {
    return fail(401, "auth_required", "Faça login para criar uma receita.");
  }

  let body;
  try {
    body = await readJson(request, RECIPE_LIMITS.maxPayloadBytes);
  } catch (error) {
    return failFromError(error);
  }

  const { value, errors } = validateRecipe(body);
  if (value === null) {
    return fail(400, "validation_failed", "Dados da receita inválidos.", { details: errors });
  }

  // Autoria vem SEMPRE da sessão assinada — nunca do corpo da requisição.
  const authorId = viewer.userId;

  /** @type {number} */
  let recipeId = 0;

  try {
    const [upsertResult, insertResult] = await db.batch([
      db
        .prepare(
          `INSERT INTO discord_users (user_id, username, avatar, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             username = excluded.username,
             avatar = excluded.avatar,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(authorId, viewer.username || "Usuário Discord", viewer.avatar || ""),
      db
        .prepare(
          `INSERT INTO recipes (user_id, title, description, prep_minutes, base_servings)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(authorId, value.title, value.description, value.prepMinutes, value.baseServings),
    ]);

    recipeId = Number(insertResult?.meta?.last_row_id ?? upsertResult?.meta?.last_row_id ?? 0);
  } catch {
    console.error("Falha ao inserir a receita no D1.");
    return fail(500, "persistence_failed", "Não foi possível salvar a receita.");
  }

  if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
    return fail(500, "persistence_failed", "Não foi possível identificar a receita criada.");
  }

  // Filhos gravados em um único batch (mesma transação, posições 1..N).
  const statements = [
    ...value.ingredients.map((ingredient, index) =>
      db
        .prepare(
          "INSERT INTO recipe_ingredients (recipe_id, position, name, quantity, unit) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(recipeId, index + 1, ingredient.name, ingredient.quantity, ingredient.unit),
    ),
    ...value.steps.map((instruction, index) =>
      db
        .prepare("INSERT INTO recipe_steps (recipe_id, position, instruction) VALUES (?, ?, ?)")
        .bind(recipeId, index + 1, instruction),
    ),
  ];

  try {
    await db.batch(statements);
  } catch {
    // Rollback best-effort: remove a receita (CASCADE limpa filhos órfãos).
    try {
      await db.prepare("DELETE FROM recipes WHERE id = ?").bind(recipeId).run();
    } catch {
      /* nada a fazer além de reportar a falha */
    }
    console.error("Falha ao inserir ingredientes/passos no D1.");
    return fail(500, "persistence_failed", "Não foi possível salvar os detalhes da receita.");
  }

  try {
    const detail = await loadRecipeDetail(env, recipeId, authorId);
    if (!detail) {
      return fail(500, "persistence_failed", "Receita criada, mas não foi possível recarregá-la.");
    }
    return json({ ok: true, recipe: detail }, 201);
  } catch {
    console.error("Falha ao recarregar a receita criada.");
    return fail(500, "query_failed", "Receita criada, mas não foi possível recarregá-la.");
  }
}

/**
 * Métodos não suportados → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
