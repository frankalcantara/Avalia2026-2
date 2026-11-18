/**
 * Cloudflare Pages Function — `/api/recipes/[id]`
 *
 *  * `GET`    → detalhe completo (ingredientes e passos ordenados por `position`).
 *  * `DELETE` → exclusão restrita ao autor (`403 forbidden_not_owner`).
 *
 * @module functions/api/recipes/[id]
 */

import { fail, json } from "../_lib/http.js";
import { loadRecipeDetail } from "../_lib/d1.js";
import { getSessionUser } from "../_lib/session.js";
import { parsePositiveId } from "../_lib/validate.js";

/**
 * `GET /api/recipes/:id`
 *
 * @param {{ request: Request, env: Record<string, unknown>, params: Record<string, string> }} context
 * @returns {Promise<Response>} Detalhe da receita.
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const recipeId = parsePositiveId(params?.id);
  if (recipeId === null) {
    return fail(400, "invalid_id", "Identificador de receita inválido.");
  }

  const viewer = await getSessionUser(request, env);

  try {
    const recipe = await loadRecipeDetail(env, recipeId, viewer?.userId ?? null);
    if (!recipe) {
      return fail(404, "recipe_not_found", "Receita não encontrada.");
    }
    return json({ ok: true, recipe });
  } catch {
    console.error("Falha ao carregar o detalhe da receita no D1.");
    return fail(500, "query_failed", "Não foi possível carregar a receita.");
  }
}

/**
 * `DELETE /api/recipes/:id`
 *
 * @param {{ request: Request, env: Record<string, unknown>, params: Record<string, string> }} context
 * @returns {Promise<Response>} `{ ok:true, deletedId }`.
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const db = env?.DB;
  if (!db || typeof db.prepare !== "function") {
    return fail(503, "database_unavailable", "Banco de dados indisponível neste ambiente.");
  }

  const viewer = await getSessionUser(request, env);
  if (!viewer) {
    return fail(401, "auth_required", "Faça login para excluir uma receita.");
  }

  const recipeId = parsePositiveId(params?.id);
  if (recipeId === null) {
    return fail(400, "invalid_id", "Identificador de receita inválido.");
  }

  /** @type {{ user_id?: string } | null} */
  let ownerRow;
  try {
    ownerRow = await db.prepare("SELECT user_id FROM recipes WHERE id = ? LIMIT 1").bind(recipeId).first();
  } catch {
    console.error("Falha ao verificar a autoria da receita no D1.");
    return fail(500, "query_failed", "Não foi possível verificar a receita.");
  }

  if (!ownerRow) {
    return fail(404, "recipe_not_found", "Receita não encontrada.");
  }
  if (String(ownerRow.user_id) !== viewer.userId) {
    return fail(403, "forbidden_not_owner", "Apenas o autor pode excluir esta receita.");
  }

  try {
    await db.batch([
      db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").bind(recipeId),
      db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").bind(recipeId),
      db.prepare("DELETE FROM favorites WHERE recipe_id = ?").bind(recipeId),
      db.prepare("DELETE FROM recipes WHERE id = ? AND user_id = ?").bind(recipeId, viewer.userId),
    ]);
  } catch {
    console.error("Falha ao excluir a receita no D1.");
    return fail(500, "persistence_failed", "Não foi possível excluir a receita.");
  }

  return json({ ok: true, deletedId: recipeId });
}

/**
 * Métodos não suportados → 405 em JSON.
 *
 * @returns {Response} 405 `method_not_allowed`.
 */
export function onRequest() {
  return fail(405, "method_not_allowed", "Método não permitido para este endpoint.");
}
