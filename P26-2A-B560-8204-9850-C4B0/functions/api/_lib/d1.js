/**
 * Helpers de acesso ao Cloudflare D1: mapeamento row → DTO e consultas compostas.
 *
 * Todas as consultas usam `prepare(...).bind(...)` — nunca concatenação de SQL
 * com dados vindos do cliente.
 *
 * @module functions/api/_lib/d1
 */

/**
 * Mapeia uma linha de receita (com JOIN em `discord_users`) para o DTO de listagem.
 *
 * @param {Record<string, unknown>} row Linha retornada pelo D1.
 * @returns {{
 *   id: number,
 *   title: string,
 *   description: string,
 *   prepMinutes: number,
 *   baseServings: number,
 *   ingredientCount: number,
 *   createdAt: string,
 *   author: { userId: string, username: string, avatar: string },
 *   isFavorite: boolean
 * }}
 */
export function mapRecipeSummary(row) {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    prepMinutes: Number(row.prep_minutes ?? 0),
    baseServings: Number(row.base_servings ?? 0),
    ingredientCount: Number(row.ingredient_count ?? 0),
    createdAt: String(row.created_at ?? ""),
    author: {
      userId: String(row.author_user_id ?? ""),
      username: String(row.author_username ?? ""),
      avatar: String(row.author_avatar ?? ""),
    },
    isFavorite: Number(row.is_favorite ?? 0) === 1,
  };
}

/**
 * Mapeia uma linha de `recipe_ingredients` para o DTO público.
 *
 * @param {Record<string, unknown>} row Linha do D1.
 * @returns {{ position: number, name: string, quantity: number, unit: string }}
 */
export function mapIngredient(row) {
  return {
    position: Number(row.position ?? 0),
    name: String(row.name ?? ""),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? ""),
  };
}

/**
 * Mapeia uma linha de `recipe_steps` para o DTO público.
 *
 * @param {Record<string, unknown>} row Linha do D1.
 * @returns {{ position: number, instruction: string }}
 */
export function mapStep(row) {
  return {
    position: Number(row.position ?? 0),
    instruction: String(row.instruction ?? ""),
  };
}

/**
 * Consulta usada para montar o detalhe completo de uma receita.
 * O `?` do EXISTS é o `user_id` do visitante (string vazia quando anônimo).
 */
const DETAIL_RECIPE_SQL = `
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
    EXISTS (
      SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = ?
    ) AS is_favorite
  FROM recipes r
  JOIN discord_users u ON u.user_id = r.user_id
  WHERE r.id = ?
  LIMIT 1
`;

/**
 * Carrega o detalhe completo (receita + ingredientes + passos) em um único batch.
 *
 * @param {{ DB: D1Database }} env Bindings do Pages Functions.
 * @param {number} recipeId Id da receita.
 * @param {string | null} viewerId Usuário autenticado (para `isFavorite`/`isOwner`).
 * @returns {Promise<null | {
 *   id: number,
 *   title: string,
 *   description: string,
 *   prepMinutes: number,
 *   baseServings: number,
 *   createdAt: string,
 *   author: { userId: string, username: string, avatar: string },
 *   isOwner: boolean,
 *   isFavorite: boolean,
 *   ingredients: Array<{ position: number, name: string, quantity: number, unit: string }>,
 *   steps: Array<{ position: number, instruction: string }>
 * }>} Detalhe da receita ou `null` quando não existir.
 */
export async function loadRecipeDetail(env, recipeId, viewerId) {
  const [recipeResult, ingredientsResult, stepsResult] = await env.DB.batch([
    env.DB.prepare(DETAIL_RECIPE_SQL).bind(viewerId ?? "", recipeId),
    env.DB.prepare(
      "SELECT position, name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position ASC",
    ).bind(recipeId),
    env.DB.prepare(
      "SELECT position, instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY position ASC",
    ).bind(recipeId),
  ]);

  const row = recipeResult.results?.[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    prepMinutes: Number(row.prep_minutes ?? 0),
    baseServings: Number(row.base_servings ?? 0),
    createdAt: String(row.created_at ?? ""),
    author: {
      userId: String(row.author_user_id ?? ""),
      username: String(row.author_username ?? ""),
      avatar: String(row.author_avatar ?? ""),
    },
    isOwner: Boolean(viewerId) && viewerId === String(row.author_user_id ?? ""),
    isFavorite: Number(row.is_favorite ?? 0) === 1,
    ingredients: (ingredientsResult.results ?? []).map(mapIngredient),
    steps: (stepsResult.results ?? []).map(mapStep),
  };
}
