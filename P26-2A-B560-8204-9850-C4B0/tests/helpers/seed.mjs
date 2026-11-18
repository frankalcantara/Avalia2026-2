/**
 * Fixtures de banco: 2 usuários, 3 receitas (com ingredientes e passos) e
 * favoritos opcionais, inseridos por SQL direto no D1 falso.
 *
 * `created_at` explícito garante ordenação determinística (`ORDER BY created_at DESC, id DESC`).
 *
 * @module tests/helpers/seed
 */

import { USER_A, USER_B } from "./env.mjs";

/**
 * Linhas de `discord_users` usadas pelas fixtures.
 */
export const SEED_USERS = [
  { user_id: USER_A.userId, username: USER_A.username, avatar: USER_A.avatar },
  { user_id: USER_B.userId, username: USER_B.username, avatar: USER_B.avatar },
];

/**
 * Receitas das fixtures (com filhos na ordem das posições 1..N).
 */
export const SEED_RECIPES = [
  {
    owner: USER_A.userId,
    title: "Bolo de Cenoura",
    description: "Bolo úmido de cenoura com cobertura simples de chocolate.",
    prepMinutes: 45,
    baseServings: 8,
    createdAt: "2026-01-01 10:00:00",
    ingredients: [
      { name: "Farinha de trigo", quantity: 2.5, unit: "xícara" },
      { name: "Cenoura", quantity: 3, unit: "unidade" },
      { name: "Açúcar", quantity: 1.5, unit: "xícara" },
    ],
    steps: [
      "Bata a cenoura com os ovos no liquidificador.",
      "Misture a farinha e asse por quarenta minutos.",
    ],
  },
  {
    owner: USER_A.userId,
    title: "Sopa de Tomate",
    description: "Sopa leve de tomate com manjericão fresco e sal marinho.",
    prepMinutes: 25,
    baseServings: 4,
    createdAt: "2026-01-02 10:00:00",
    ingredients: [
      { name: "Tomate", quantity: 6, unit: "unidade" },
      { name: "Sal", quantity: 1, unit: "colher de chá" },
    ],
    steps: ["Cozinhe os tomates por vinte minutos e bata tudo."],
  },
  {
    owner: USER_B.userId,
    title: "Panqueca 100% Integral",
    description: "Panqueca integral sem açúcar adicionado, ideal para o café.",
    prepMinutes: 30,
    baseServings: 2,
    createdAt: "2026-01-03 10:00:00",
    ingredients: [
      { name: "Farinha integral", quantity: 1, unit: "xícara" },
      { name: "Ovo", quantity: 2, unit: "unidade" },
    ],
    steps: [
      "Misture todos os ingredientes até a massa ficar lisa.",
      "Doure cada panqueca em frigideira antiaderente.",
    ],
  },
];

/**
 * Insere uma receita completa e devolve o id gerado.
 *
 * @param {import("./d1-mock.mjs").MockD1} db Banco destino.
 * @param {(typeof SEED_RECIPES)[number]} recipe Dados da receita.
 * @returns {Promise<number>} Id criado.
 */
async function insertRecipe(db, recipe) {
  const inserted = await db
    .prepare(
      `INSERT INTO recipes (user_id, title, description, prep_minutes, base_servings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      recipe.owner,
      recipe.title,
      recipe.description,
      recipe.prepMinutes,
      recipe.baseServings,
      recipe.createdAt,
      recipe.createdAt,
    )
    .run();

  const recipeId = Number(inserted.meta.last_row_id);

  for (const [index, ingredient] of recipe.ingredients.entries()) {
    await db
      .prepare(
        "INSERT INTO recipe_ingredients (recipe_id, position, name, quantity, unit) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(recipeId, index + 1, ingredient.name, ingredient.quantity, ingredient.unit)
      .run();
  }

  for (const [index, instruction] of recipe.steps.entries()) {
    await db
      .prepare("INSERT INTO recipe_steps (recipe_id, position, instruction) VALUES (?, ?, ?)")
      .bind(recipeId, index + 1, instruction)
      .run();
  }

  return recipeId;
}

/**
 * Popula o banco com usuários e receitas de exemplo.
 *
 * @param {import("./d1-mock.mjs").MockD1} db Banco destino.
 * @returns {Promise<{ recipeIds: number[] }}> Ids das receitas (ordem do seed).
 */
export async function seedDatabase(db) {
  for (const user of SEED_USERS) {
    await db
      .prepare("INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)")
      .bind(user.user_id, user.username, user.avatar)
      .run();
  }

  const recipeIds = [];
  for (const recipe of SEED_RECIPES) {
    recipeIds.push(await insertRecipe(db, recipe));
  }
  return { recipeIds };
}

/**
 * Cria o primeiro usuário (útil em testes que não precisam das receitas).
 *
 * @param {import("./d1-mock.mjs").MockD1} db Banco destino.
 * @param {{ userId: string, username?: string, avatar?: string }} [user] Usuário.
 * @returns {Promise<void>} Resolução após o INSERT.
 */
export async function seedUser(db, user = USER_A) {
  await db
    .prepare("INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)")
    .bind(user.userId, user.username ?? "", user.avatar ?? "")
    .run();
}

/**
 * Insere um favorito.
 *
 * @param {import("./d1-mock.mjs").MockD1} db Banco destino.
 * @param {string} userId Usuário.
 * @param {number} recipeId Receita.
 * @returns {Promise<void>} Resolução após o INSERT.
 */
export async function seedFavorite(db, userId, recipeId) {
  await db.prepare("INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)").bind(userId, recipeId).run();
}

/**
 * Conta linhas de uma tabela (asserções de limpeza/cascade).
 *
 * @param {import("./d1-mock.mjs").MockD1} db Banco consultado.
 * @param {"recipes" | "recipe_ingredients" | "recipe_steps" | "favorites" | "discord_users"} table Tabela.
 * @param {string} whereClause Condição opcional sem a palavra WHERE.
 * @param {unknown[]} [params] Parâmetros da condição.
 * @returns {Promise<number>} Total de linhas.
 */
export async function countRows(db, table, whereClause = "", params = []) {
  const sql = `SELECT COUNT(*) AS total FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ""}`;
  const row = await db.prepare(sql).bind(...params).first();
  return Number(row?.total ?? 0);
}

/**
 * Busca uma receita por id diretamente no banco.
 *
 * @param {import("./d1-mock.mjs").MockD1} db Banco consultado.
 * @param {number} recipeId Id.
 * @returns {Promise<Record<string, unknown> | null>} Linha ou `null`.
 */
export async function findRecipeRow(db, recipeId) {
  return db.prepare("SELECT * FROM recipes WHERE id = ? LIMIT 1").bind(recipeId).first();
}
