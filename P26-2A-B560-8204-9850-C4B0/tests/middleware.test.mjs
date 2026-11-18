/**
 * Testes do middleware de borda `/api/*` (`functions/api/_middleware.js`).
 *
 * Cobrem o requisito de rubrica "CORS com allowlist estrita + preflight
 * OPTIONS + rate limit", que os handlers individuais não exercitam porque
 * são invocados diretamente nos outros arquivos de teste.
 *
 * Chave Única: P26-2A-B560-8204-9850-C4B0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BASE_URL, makeContext, makeEnv, makeRequest, readJson } from "./helpers/env.mjs";
import { onRequest } from "../functions/api/_middleware.js";

/** Origem externa explicitamente autorizada pela allowlist do teste. */
const TRUSTED = "https://p26-2a-b560-8204-9850-c4b0.pages.dev";

/** Origem qualquer, fora da allowlist. */
const UNTRUSTED = "https://evil.example.com";

/**
 * Executa o middleware com um `next` controlado.
 *
 * @param {{ url?: string, method?: string, origin?: string | null, headers?: Record<string,string>, status?: number }} options
 * @returns {Promise<Response>} Resposta finalizada pelo middleware.
 */
async function run(options = {}) {
  const { url = "/api/status", method = "GET", origin, headers = {}, status = 200 } = options;
  const request = makeRequest(url, { method, origin, headers });
  const env = makeEnv({ ALLOWED_ORIGINS: TRUSTED });
  const context = makeContext({ request, env });
  context.next = async () => new Response(JSON.stringify({ ok: true }), { status });
  return onRequest(context);
}

describe("middleware /api/* — CORS, preflight, CSRF e hardening", () => {
  it("OPTIONS de origem autorizada responde 204 com allowlist e credenciais", async () => {
    const res = await run({ method: "OPTIONS", origin: TRUSTED });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), TRUSTED);
    assert.equal(res.headers.get("Access-Control-Allow-Credentials"), "true");
    assert.equal(res.headers.get("Vary"), "Origin");
    assert.match(res.headers.get("Access-Control-Allow-Methods") ?? "", /GET/);
    assert.match(res.headers.get("Access-Control-Allow-Methods") ?? "", /OPTIONS/);
  });

  it("OPTIONS de origem desconhecida responde 403 sem Access-Control-Allow-Origin", async () => {
    const res = await run({ method: "OPTIONS", origin: UNTRUSTED });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
    const data = await readJson(res);
    assert.equal(data.error.code, "origin_not_allowed");
  });

  it("GET de origem desconhecida é bloqueado antes de tocar no D1 (403)", async () => {
    const res = await run({ origin: UNTRUSTED });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  });

  it("POST de origem desconhecida é bloqueado (403) — anti-CSRF", async () => {
    const res = await run({ url: "/api/recipes", method: "POST", origin: UNTRUSTED });
    assert.equal(res.status, 403);
  });

  it("requisição de mesma origem passa pelo next e recebe headers de segurança", async () => {
    const res = await run({ origin: BASE_URL });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), BASE_URL);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(res.headers.get("X-Frame-Options"), "DENY");
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.match(res.headers.get("Strict-Transport-Security") ?? "", /max-age=/);
    assert.match(res.headers.get("Content-Security-Policy") ?? "", /default-src 'none'/);
  });

  it("OPTIONS sem Origin responde 204 sem credenciais", async () => {
    const res = await run({ method: "OPTIONS", origin: null });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(res.headers.get("Access-Control-Allow-Credentials"), null);
  });

  it("exceção no handler vira 500 JSON sem vazar detalhes internos", async () => {
    const request = makeRequest("/api/status", { origin: BASE_URL });
    const context = makeContext({ request, env: makeEnv({ ALLOWED_ORIGINS: TRUSTED }) });
    context.next = async () => {
      throw new Error("stack interna sensível");
    };
    const res = await onRequest(context);
    assert.equal(res.status, 500);
    const data = await readJson(res);
    assert.equal(data.error.code, "internal_error");
    assert.ok(!JSON.stringify(data).includes("sensível"));
  });

  it("rate limit de leitura: 120 permitidas, a 121ª responde 429 com Retry-After", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.10" };
    for (let i = 0; i < 120; i += 1) {
      const res = await run({ headers, origin: BASE_URL });
      assert.equal(res.status, 200, `requisição ${i + 1} deveria passar`);
    }
    const blocked = await run({ headers, origin: BASE_URL });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("Retry-After")) >= 1);
    const data = await readJson(blocked);
    assert.equal(data.error.code, "rate_limited");
  });

  it("rate limit de escrita: 30 permitidas, a 31ª responde 429", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.20" };
    for (let i = 0; i < 30; i += 1) {
      const res = await run({ url: "/api/recipes", method: "POST", headers, origin: BASE_URL });
      assert.equal(res.status, 200, `escrita ${i + 1} deveria passar`);
    }
    const blocked = await run({ url: "/api/recipes", method: "POST", headers, origin: BASE_URL });
    assert.equal(blocked.status, 429);
  });

  it("buckets de IPs distintos são independentes (sem bloqueio cruzado)", async () => {
    const a = { "CF-Connecting-IP": "203.0.113.31" };
    const b = { "CF-Connecting-IP": "203.0.113.32" };
    for (let i = 0; i < 120; i += 1) await run({ headers: a, origin: BASE_URL });
    assert.equal((await run({ headers: a, origin: BASE_URL })).status, 429);
    assert.equal((await run({ headers: b, origin: BASE_URL })).status, 200);
  });
});
