import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeRequest, sessionCookie, makeContext, readJson } from "./helpers/env.mjs";
import { seedDatabase, seedFavorite } from "./helpers/seed.mjs";

let handlers = {};
async function loadHandlers(env) {
  const { onRequestPost: postFav, onRequestGet: getFav, onRequestDelete: deleteFav } = await import("../functions/api/recipes/[id]/favorite.js");
  const { onRequestGet: getFavs } = await import("../functions/api/favorites.js");
  return { postFav, getFav, deleteFav, getFavs };
}

describe("Favoritos (toggle, estado, lista /api/favorites, scope=favorites)", () => {
  let env, h;

  beforeEach(async () => {
    env = makeEnv({});
    await seedDatabase(env.DB);
    h = await loadHandlers(env);
  });

  const user1 = { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/embed/avatars/0.png" };
  const user2 = { userId: "200000000000000002", username: "ana", avatar: "https://cdn.discordapp.com/embed/avatars/1.png" };

  it("POST /api/recipes/1/favorite cria favorito e retorna isFavorite=true", async () => {
    const req = makeRequest("/api/recipes/1/favorite", {
      method: "POST",
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.postFav(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.isFavorite, true);
    assert.equal(data.recipeId, 1);
  });

  it("POST /api/recipes/1/favorite segunda vez remove favorito (toggle) e retorna isFavorite=false", async () => {
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/1/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user1) } }), env, params: { id: "1" } }));
    const req = makeRequest("/api/recipes/1/favorite", {
      method: "POST",
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.postFav(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.isFavorite, false);
  });

  it("GET /api/recipes/1/favorite retorna estado atual", async () => {
    let req = makeRequest("/api/recipes/1/favorite", { cookies: { receitas_session: await sessionCookie(env, user1) } });
    let ctx = makeContext({ request: req, env, params: { id: "1" } });
    let res = await h.getFav(ctx);
    assert.equal(res.status, 200);
    let data = await readJson(res);
    assert.equal(data.isFavorite, false);
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/1/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user1) } }), env, params: { id: "1" } }));
    req = makeRequest("/api/recipes/1/favorite", { cookies: { receitas_session: await sessionCookie(env, user1) } });
    ctx = makeContext({ request: req, env, params: { id: "1" } });
    res = await h.getFav(ctx);
    data = await readJson(res);
    assert.equal(data.isFavorite, true);
  });

  it("DELETE /api/recipes/1/favorite remove favorito idempotente", async () => {
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/1/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user1) } }), env, params: { id: "1" } }));
    const req = makeRequest("/api/recipes/1/favorite", {
      method: "DELETE",
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx = makeContext({ request: req, env, params: { id: "1" } });
    const res = await h.deleteFav(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.isFavorite, false);
    // Segunda vez também deve retornar 200 (idempotente)
    const req2 = makeRequest("/api/recipes/1/favorite", {
      method: "DELETE",
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx2 = makeContext({ request: req2, env, params: { id: "1" } });
    const res2 = await h.deleteFav(ctx2);
    assert.equal(res2.status, 200);
  });

  it("GET /api/favorites lista apenas favoritos do usuário autenticado", async () => {
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/1/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user1) } }), env, params: { id: "1" } }));
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/2/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user1) } }), env, params: { id: "2" } }));
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/3/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user2) } }), env, params: { id: "3" } }));

    const req = makeRequest("/api/favorites", { cookies: { receitas_session: await sessionCookie(env, user1) } });
    const ctx = makeContext({ request: req, env });
    const res = await h.getFavs(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.items.length, 2);
    for (const item of data.items) {
      assert.ok([1, 2].includes(item.id));
    }
  });

  it("scope=favorites no /api/recipes lista favoritos do usuário", async () => {
    await h.postFav(makeContext({ request: makeRequest("/api/recipes/1/favorite", { method: "POST", cookies: { receitas_session: await sessionCookie(env, user1) } }), env, params: { id: "1" } }));
    const { onRequestGet: getAll } = await import("../functions/api/recipes/index.js");
    const req = makeRequest("/api/recipes?scope=favorites", { cookies: { receitas_session: await sessionCookie(env, user1) } });
    const ctx = makeContext({ request: req, env });
    const res = await getAll(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].id, 1);
    assert.equal(data.items[0].isFavorite, true);
  });

  it("favoritar receita inexistente retorna 404", async () => {
    const req = makeRequest("/api/recipes/999/favorite", {
      method: "POST",
      cookies: { receitas_session: await sessionCookie(env, user1) },
    });
    const ctx = makeContext({ request: req, env, params: { id: "999" } });
    const res = await h.postFav(ctx);
    assert.equal(res.status, 404);
  });

  it("sem sessão retorna 401 em todas as operações de favorito", async () => {
    const endpoints = [
      { method: "POST", path: "/api/recipes/1/favorite", handler: "postFav" },
      { method: "GET", path: "/api/recipes/1/favorite", handler: "getFav" },
      { method: "DELETE", path: "/api/recipes/1/favorite", handler: "deleteFav" },
      { method: "GET", path: "/api/favorites", handler: "getFavs" },
    ];
    for (const ep of endpoints) {
      const req = makeRequest(ep.path, { method: ep.method });
      const ctx = makeContext({ request: req, env, params: { id: "1" } });
      const res = await h[ep.handler](ctx);
      assert.equal(res.status, 401, `${ep.method} ${ep.path} deveria retornar 401 sem sessão`);
    }
  });
});