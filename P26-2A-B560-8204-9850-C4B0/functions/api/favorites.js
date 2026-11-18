/**
 * Cloudflare Pages Function — `GET /api/favorites`
 *
 * Lista as receitas favoritadas pelo usuário autenticado, no mesmo shape de
 * `/api/recipes` (`isFavorite` sempre `true`). Requer sessão válida.
 *
 * @module functions/api/favorites
 */

import { fail, json } from "./_lib/http.js";
import { mapRecipeSummary } from "./_lib/d1.js";
import { getSessionUser } from "./_lib/session.js";

/** Limite padrão de itens por página. */
const DEFAULT_LIMIT = 20;

/** Limite máximo de itens por página. */
const MAX_LIMIT = 50;

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
 * `GET /api/favorites`
 *
 * @param {{ request: Request, env: Record<string, unknown> }} context Contexto do Pages Functions.
 * @returns {Promise<Response>} Lista paginada de receitas favoritas.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const viewer = await getSessionUser(request, env);
  if (!viewer) {
    return fail(401, "auth_required", "Faça login para ver seus favoritos.");
  }

  const url = new URL(request.url);
  const limit = readBoundedInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = readBoundedInt(url.searchParams.get("offset"), 0, 0, 1000000);

  const countSql = "SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?";

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
      1 AS is_favorite
    FROM favorites f
    JOIN recipes r ON r.id = f.recipe_id
    JOIN discord_users u ON u.user_id = r.user_id
    WHERE f.user_id = ?
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const [countResult, listResult] = await db.batch([
      db.prepare(countSql).bind(viewer.userId),
      db.prepare(listSql).bind(viewer.userId, limit, offset),
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
    console.error("Falha ao listar favoritos no D1.");
    return fail(500, "query_failed", "Não foi possível listar os favoritos.");
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
