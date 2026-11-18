import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeRequest, sessionCookie, makeContext, readJson } from "./helpers/env.mjs";
import { seedDatabase } from "./helpers/seed.mjs";

// Import handlers dinamicamente
let handlers = {};
async function loadHandlers(env) {
  const { onRequestGet: getAll, onRequestPost: postAll } = await import("../functions/api/recipes/index.js");
  const { onRequestGet: getOne, onRequestDelete: deleteOne } = await import("../functions/api/recipes/[id].js");
  return { getAll, postAll, getOne, deleteOne };
}

describe("CRUD de Receitas via Handlers HTTP", () => {
  let env, h;

  beforeEach(async () => {
    env = makeEnv({});
    await seedDatabase(env.DB);
    h = await loadHandlers(env);
  });

  it("POST /api/recipes sem sessão retorna 401", async () => {
    const req = makeRequest("/api/recipes", {
      method: "POST",
      body: {
        title: "Teste",
        description: "Descrição válida longa",
        prepMinutes: 10,
        baseServings: 2,
        ingredients: [{ name: "Farinha", quantity: 100, unit: "g" }],
        steps: ["Misturar", "Assar"],
      },
    });
    const ctx = makeContext({ request: req, env });
    const res = await h.postAll(ctx);
    assert.equal(res.status, 401);
    const data = await readJson(res);
    assert.equal(data.error.code, "auth_required");
  });

  it("POST /api/recipes com sessão e payload válido retorna 201 e autoria = uid da sessão", async () => {
    const user = { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/embed/avatars/0.png" };
    const req = makeRequest("/api/recipes", {
      method: "POST",
      body: {
        title: "Bolo de Cenoura",
        description: "Delicioso bolo de cenoura com cobertura de chocolate",
        prepMinutes: 45,
        baseServings: 8,
        ingredients: [
          { name: "Cenoura", quantity: 200, unit: "g" },
          { name: "Farinha", quantity: 200, unit: "g" },
        ],
        steps: ["Bater tudo", "Levar ao forno", "Cobrir"],
      },
      cookies: { receitas_session: await sessionCookie(env, user) },
    });
    const ctx = makeContext({ request: req, env });
    const res = await h.postAll(ctx);
    assert.equal(res.status, 201);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.recipe.author.userId, "100000000000000001");
    assert.ok(data.recipe.id > 3);
  });

  it("GET /api/recipes retorna lista com author, ingredientCount, isFavorite", async () => {
    const req = makeRequest("/api/recipes");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.ok(Array.isArray(data.items));
    assert.equal(data.items.length, 3);
    for (const item of data.items) {
      assert.ok(item.author && item.author.userId);
      assert.ok(typeof item.ingredientCount === "number");
      assert.ok(typeof item.isFavorite === "boolean");
    }
  });

  it("GET /api/recipes/:id retorna detalhe com ingredientes/passos ordenados por position", async () => {
    const req = makeRequest("/api/recipes/1");
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.getOne(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.ok(data.recipe);
    assert.ok(Array.isArray(data.recipe.ingredients));
    assert.ok(Array.isArray(data.recipe.steps));
    for (let i = 1; i < data.recipe.ingredients.length; i++) {
      assert.ok(data.recipe.ingredients[i-1].position < data.recipe.ingredients[i].position);
    }
    for (let i = 1; i < data.recipe.steps.length; i++) {
      assert.ok(data.recipe.steps[i-1].position < data.recipe.steps[i].position);
    }
    assert.ok(typeof data.recipe.isOwner === "boolean");
    assert.ok(typeof data.recipe.isFavorite === "boolean");
  });

  it("GET /api/recipes/:id com id inexistente retorna 404", async () => {
    const req = makeRequest("/api/recipes/999");
    const ctx = makeContext({ request: req, env, params: { id: "999" } });
    const res = await h.getOne(ctx);
    assert.equal(res.status, 404);
  });

  it("GET /api/recipes/:id com id inválido retorna 400", async () => {
    for (const id of ["abc", "-1", "1.5", "0", "..%2f.."]) {
      const req = makeRequest(`/api/recipes/${id}`);
      const ctx = makeContext({ request: req, env, params: { id } });
      const res = await h.getOne(ctx);
      assert.equal(res.status, 400, `id=${id} deveria retornar 400`);
    }
  });

  it("detalhe expõe quantity (numérico REAL), unit e name em campos separados, persistidos no D1", async () => {
    const req = makeRequest("/api/recipes/1");
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.getOne(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);

    const [primeiro] = data.recipe.ingredients;
    assert.equal(primeiro.position, 1);
    assert.equal(primeiro.name, "Farinha de trigo");
    assert.equal(primeiro.unit, "xícara");
    assert.equal(typeof primeiro.quantity, "number");
    assert.equal(primeiro.quantity, 2.5);

    // Confirma que as três informações vivem em COLUNAS separadas no schema D1.
    const linhas = await env.DB.prepare(
      "SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position",
    )
      .bind(1)
      .all();
    assert.equal(linhas.results.length, 3);
    for (const linha of linhas.results) {
      assert.equal(typeof linha.quantity, "number");
      assert.equal(typeof linha.name, "string");
      assert.equal(typeof linha.unit, "string");
      assert.ok(linha.unit.length > 0);
    }

    // Passos sequenciais: position 1..N com instrução textual.
    data.recipe.steps.forEach((passo, indice) => {
      assert.equal(passo.position, indice + 1);
      assert.equal(typeof passo.instruction, "string");
      assert.ok(passo.instruction.length > 0);
    });
  });

  it("DELETE /api/recipes/:id por não-autor retorna 403 e receita permanece", async () => {
    const user2 = { userId: "200000000000000002", username: "ana", avatar: "https://cdn.discordapp.com/embed/avatars/1.png" };
    const req = makeRequest("/api/recipes/1", {
      method: "DELETE",
      cookies: { receitas_session: await sessionCookie(env, user2) },
    });
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.deleteOne(ctx);
    assert.equal(res.status, 403);
    const data = await readJson(res);
    assert.equal(data.error.code, "forbidden_not_owner");
    // Verificar que a receita ainda existe
    const checkReq = makeRequest("/api/recipes/1");
    const checkCtx = makeContext({ request: checkReq, env, params: { id: "1" } });
    const checkRes = await h.getOne(checkCtx);
    assert.equal(checkRes.status, 200);
  });

  it("DELETE /api/recipes/:id pelo autor retorna 200 e remove filhos via FK", async () => {
    const user1 = { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/embed/avatars/0.png" };
    const req = makeRequest("/api/recipes/1", {
      method: "DELETE",
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.deleteOne(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.deletedId, 1);
    // Verificar que a receita foi removida
    const checkReq = makeRequest("/api/recipes/1");
    const checkCtx = makeContext({ request: checkReq, env, params: { id: "1" } });
    const checkRes = await h.getOne(checkCtx);
    assert.equal(checkRes.status, 404);
  });

  it("scope=mine filtra apenas receitas do usuário autenticado", async () => {
    const user1 = { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/embed/avatars/0.png" };
    const req = makeRequest("/api/recipes?scope=mine", {
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    for (const item of data.items) {
      assert.equal(item.author.userId, "100000000000000001");
    }
  });

  it("scope=all anônimo funciona e lista todas", async () => {
    const req = makeRequest("/api/recipes?scope=all");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.items.length, 3);
  });
});