import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeRequest, makeContext, readJson } from "./helpers/env.mjs";
import { seedDatabase } from "./helpers/seed.mjs";

let handlers = {};
async function loadHandlers(env) {
  const { onRequestGet: getAll } = await import("../functions/api/recipes/index.js");
  return { getAll };
}

describe("Busca de Receitas (q, ingredient, maxTime, scope, limit, offset)", () => {
  let env, h;

  beforeEach(async () => {
    env = makeEnv({});
    await seedDatabase(env.DB);
    h = await loadHandlers(env);
  });

  it("busca por título case-insensitive", async () => {
    const req = makeRequest("/api/recipes?q=BOLO");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.items.length, 1);
    assert.ok(data.items[0].title.toLowerCase().includes("bolo"));
  });

  it("busca por ingrediente exato", async () => {
    const req = makeRequest("/api/recipes?ingredient=cenoura");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.items.length, 1);
  });

  it("busca por tempo máximo de preparo (inclusivo)", async () => {
    const req = makeRequest("/api/recipes?maxTime=30");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    for (const item of data.items) {
      assert.ok(item.prepMinutes <= 30);
    }
  });

  it("combina filtros q + ingredient + maxTime", async () => {
    const req = makeRequest("/api/recipes?q=bolo&ingredient=farinha&maxTime=60");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    for (const item of data.items) {
      assert.ok(item.title.toLowerCase().includes("bolo"));
      assert.ok(item.prepMinutes <= 60);
    }
  });

  it("limit clampado em 50", async () => {
    const req = makeRequest("/api/recipes?limit=999999");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.limit, 50);
  });

  it("offset funciona", async () => {
    const req1 = makeRequest("/api/recipes?limit=2&offset=0");
    const ctx1 = makeContext({ request: req1, env });
    const res1 = await h.getAll(ctx1);
    const data1 = await readJson(res1);
    const req2 = makeRequest("/api/recipes?limit=2&offset=2");
    const ctx2 = makeContext({ request: req2, env });
    const res2 = await h.getAll(ctx2);
    const data2 = await readJson(res2);
    const ids1 = data1.items.map(i => i.id);
    const ids2 = data2.items.map(i => i.id);
    for (const id of ids1) {
      assert.ok(!ids2.includes(id));
    }
  });

  it("termo com % _ \\ e emoji longo não causa 500 (regressão S-01)", async () => {
    const problematicTerms = [
      "%' OR 1=1--",
      "'; DROP TABLE recipes;--",
      "' UNION SELECT 1,2,3--",
      "%_\\",
      "ðŸ”¥".repeat(80),
      "a".repeat(200),
    ];
    for (const term of problematicTerms) {
      const req = makeRequest(`/api/recipes?q=${encodeURIComponent(term)}`);
      const ctx = makeContext({ request: req, env });
      const res = await h.getAll(ctx);
      assert.equal(res.status, 200, `Termo ${JSON.stringify(term)} causou ${res.status}`);
      const data = await readJson(res);
      assert.ok(data.ok);
    }
  });

  it("maxTime inválido retorna 400", async () => {
    const req = makeRequest("/api/recipes?maxTime=abc");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 400);
    const data = await readJson(res);
    assert.equal(data.error.code, "invalid_query");
  });

  it("scope=mine exige sessão", async () => {
    const req = makeRequest("/api/recipes?scope=mine");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 401);
    const data = await readJson(res);
    assert.equal(data.error.code, "auth_required");
  });

  it("scope=favorites exige sessão", async () => {
    const req = makeRequest("/api/recipes?scope=favorites");
    const ctx = makeContext({ request: req, env });
    const res = await h.getAll(ctx);
    assert.equal(res.status, 401);
  });
});