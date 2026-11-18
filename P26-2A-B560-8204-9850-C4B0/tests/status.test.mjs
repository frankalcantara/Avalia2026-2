import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeRequest, makeContext, readJson } from "./helpers/env.mjs";

let handlers = {};
async function loadHandlers(env) {
  const statusModule = await import("../functions/api/status.js");
  return { getStatus: statusModule.onRequestGet, postStatus: statusModule.onRequestPost };
}

describe("Endpoint /api/status", () => {
  let env, h;

  beforeEach(async () => {
    env = makeEnv({});
    h = await loadHandlers(env);
  });

  it("GET /api/status retorna 200 com chave, projectId, projectTitle, contagens", async () => {
    const req = makeRequest("/api/status");
    const ctx = makeContext({ request: req, env });
    const res = await h.getStatus(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.chave, "P26-2A-B560-8204-9850-C4B0");
    assert.equal(data.projectId, 28);
    assert.equal(data.projectTitle, "Livro de Receitas Colaborativo com Escalonador de Porções");
    assert.ok(typeof data.d1Connected === "boolean");
    assert.ok(typeof data.discordOAuthConfigured === "boolean");
    assert.ok(typeof data.recipesCount === "number");
    assert.ok(typeof data.usersCount === "number");
    assert.ok(data.timestamp);
  });

  it("POST /api/status retorna 405 method_not_allowed", async () => {
    const req = makeRequest("/api/status", { method: "POST", body: {} });
    const ctx = makeContext({ request: req, env });
    const statusModule = await import("../functions/api/status.js");
    const res = await statusModule.onRequest(ctx);
    assert.equal(res.status, 405);
  });
});