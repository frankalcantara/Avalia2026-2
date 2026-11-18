/**
 * Cloudflare Pages Function — `/api/recipes/[id]/favorite`
 *
 *  * `GET`    → informa o estado atual de favorito.
 *  * `POST`   → alterna (toggle) o favorito do usuário autenticado.
 *  * `DELETE` → remove o favorito (idempotente).
 *
 * @module functions/api/recipes/[id]/favorite
 */

import { fail, json } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { parsePositiveId } from "../../_lib/validate.js";

/**
 * Consulta única que confirma a existência da receita e o estado de favorito.
 */
const FAVORITE_STATE_SQL = `
  SELECT
    r.id AS id,
    EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = ?) AS is_favorite
  FROM recipes r
  WHERE r.id = ?
  LIMIT 1
`;

/**
 * Lê o estado de favorito de uma receita para o usuário.
 *
 * @param {D1Database} db Binding D1.
 * @param {number} recipeId Id da receita.
 * @param {string} userId Id do usuário autenticado.
 * @returns {Promise<{ found: boolean, isFavorite: boolean }>} Estado encontrado.
 */
async function readFavoriteState(db, recipeId, userId) {
  const row = await db.prepare(FAVORITE_STATE_SQL).bind(userId, recipeId).first();
  if (!row) return { found: false, isFavorite: false };
  return { found: true, isFavorite: Number(row.is_favorite ?? 0) === 1 };
}

/**
 * `GET /api/recipes/:id/favorite`
 *
 * @param {{ request: Request, env: Record<string, unknown>, params: Record<string, string> }} context
 * @returns {Promise<Response>} `{ ok:true, recipeId, isFavorite }`.
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const viewer = await getSessionUser(request, env);
  if (!viewer) {
    return fail(401, "auth_required", "Faça login para consultar seus favoritos.");
  }

  const recipeId = parsePositiveId(params?.id);
  if (recipeId === null) {
    return fail(400, "invalid_id", "Identificador de receita inválido.");
  }

  try {
    const state = await readFavoriteState(db, recipeId, viewer.userId);
    if (!state.found) {
      return fail(404, "recipe_not_found", "Receita não encontrada.");
    }
    return json({ ok: true, recipeId, isFavorite: state.isFavorite });
  } catch {
    console.error("Falha ao consultar o favorito no D1.");
    return fail(500, "query_failed", "Não foi possível consultar o favorito.");
  }
}

/**
 * `POST /api/recipes/:id/favorite` — alterna o favorito.
 *
 * @param {{ request: Request, env: Record<string, unknown>, params: Record<string, string> }} context
 * @returns {Promise<Response>} `{ ok:true, isFavorite, recipeId }`.
 */
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const viewer = await getSessionUser(request, env);
  if (!viewer) {
    return fail(401, "auth_required", "Faça login para favoritar receitas.");
  }

  const recipeId = parsePositiveId(params?.id);
  if (recipeId === null) {
    return fail(400, "invalid_id", "Identificador de receita inválido.");
  }

  try {
    const state = await readFavoriteState(db, recipeId, viewer.userId);
    if (!state.found) {
      return fail(404, "recipe_not_found", "Receita não encontrada.");
    }

    if (state.isFavorite) {
      await db
        .prepare("DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?")
        .bind(viewer.userId, recipeId)
        .run();
      return json({ ok: true, isFavorite: false, recipeId });
    }

    // Garante a FK do usuário (sessão válida pode preceder um reset do D1).
    await db.batch([
      db
        .prepare(
          `INSERT INTO discord_users (user_id, username, avatar, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             username = excluded.username,
             avatar = excluded.avatar,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(viewer.userId, viewer.username || "Usuário Discord", viewer.avatar || ""),
      db
        .prepare("INSERT OR IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)")
        .bind(viewer.userId, recipeId),
    ]);

    return json({ ok: true, isFavorite: true, recipeId });
  } catch {
    console.error("Falha ao alternar o favorito no D1.");
    return fail(500, "persistence_failed", "Não foi possível atualizar o favorito.");
  }
}

/**
 * `DELETE /api/recipes/:id/favorite` — remoção idempotente.
 *
 * @param {{ request: Request, env: Record<string, unknown>, params: Record<string, string> }} context
 * @returns {Promise<Response>} `{ ok:true, isFavorite:false, recipeId }`.
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const viewer = await getSessionUser(request, env);
  if (!viewer) {
    return fail(401, "auth_required", "Faça login para remover favoritos.");
  }

  const recipeId = parsePositiveId(params?.id);
  if (recipeId === null) {
    return fail(400, "invalid_id", "Identificador de receita inválido.");
  }

  try {
    await db
      .prepare("DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?")
      .bind(viewer.userId, recipeId)
      .run();
  } catch {
    console.error("Falha ao remover o favorito no D1.");
    return fail(500, "persistence_failed", "Não foi possível remover o favorito.");
  }

  return json({ ok: true, isFavorite: false, recipeId });
}

/**
 * Métodos não suportados → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
