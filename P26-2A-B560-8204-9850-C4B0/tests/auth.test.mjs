import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, makeRequest, sessionCookie, makeContext, readJson } from "./helpers/env.mjs";

let handlers = {};
async function loadHandlers(env) {
  const { onRequestGet: getDiscord } = await import("../functions/api/auth/discord.js");
  const { onRequestGet: getCallback } = await import("../functions/api/auth/discord/callback.js");
  const { onRequestGet: getMe } = await import("../functions/api/auth/me.js");
  const logoutModule = await import("../functions/api/auth/logout.js");
  return { getDiscord, getCallback, getMe, postLogout: logoutModule.onRequestPost, getLogout: logoutModule.onRequestGet };
}

describe("Autenticação Discord OAuth2 (/api/auth/*)", () => {
  let env, h, originalFetch;

  beforeEach(async () => {
    env = makeEnv({});
    h = await loadHandlers(env);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("GET /api/auth/discord retorna 302 com state, cookie oauth_state e scope=identify", async () => {
    const req = makeRequest("/api/auth/discord");
    const ctx = makeContext({ request: req, env });
    const res = await h.getDiscord(ctx);
    assert.equal(res.status, 302);
    const location = res.headers.get("Location");
    assert.ok(location.startsWith("https://discord.com/api/oauth2/authorize"));
    assert.ok(location.includes("scope=identify"));
    assert.ok(location.includes("state="));
    const cookie = res.headers.get("Set-Cookie");
    assert.ok(cookie.includes("oauth_state="));
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("Secure"));
    assert.ok(cookie.includes("SameSite=Lax"));
  });

  it("GET /api/auth/discord sem DISCORD_CLIENT_ID retorna 503 discord_not_configured", async () => {
    const envNoCreds = makeEnv({ DISCORD_CLIENT_ID: "" });
    const { onRequestGet: getDiscord } = await import("../functions/api/auth/discord.js");
    const req = makeRequest("/api/auth/discord");
    const ctx = makeContext({ request: req, env: envNoCreds });
    const res = await getDiscord(ctx);
    assert.equal(res.status, 503);
    const data = await readJson(res);
    assert.equal(data.error.code, "discord_not_configured");
  });

  it("callback com state inválido/ausente retorna 400 invalid_state", async () => {
    let req = makeRequest("/api/auth/discord/callback?code=abc&state=xyz");
    let ctx = makeContext({ request: req, env });
    let res = await h.getCallback(ctx);
    assert.equal(res.status, 400);
    let data = await readJson(res);
    assert.equal(data.error.code, "invalid_state");
    const stateCookie = "oauth_state=valor_diferente; Path=/; HttpOnly; Secure; SameSite=Lax";
    req = makeRequest("/api/auth/discord/callback?code=abc&state=outro", { headers: { Cookie: stateCookie } });
    ctx = makeContext({ request: req, env });
    res = await h.getCallback(ctx);
    assert.equal(res.status, 400);
    data = await readJson(res);
    assert.equal(data.error.code, "invalid_state");
  });

  it("callback sem credenciais do Discord retorna 500/503 coerente", async () => {
    const envNoCreds = makeEnv({ DISCORD_CLIENT_ID: "", DISCORD_CLIENT_SECRET: "" });
    const { onRequestGet: getCallback } = await import("../functions/api/auth/discord/callback.js");
    const req = makeRequest("/api/auth/discord/callback?code=abc&state=qualquer", { headers: { Cookie: "oauth_state=qualquer; Path=/; HttpOnly; Secure; SameSite=Lax" } });
    const ctx = makeContext({ request: req, env: envNoCreds });
    const res = await getCallback(ctx);
    assert.ok([500, 503].includes(res.status));
  });

  it("callback com credenciais mas code inválido redireciona com login=error", async () => {
    globalThis.fetch = async (url) => {
      if (url.toString().includes("discord.com/api/oauth2/token")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      return originalFetch(url);
    };
    const req = makeRequest("/api/auth/discord/callback?code=invalid_code&state=qualquer", { headers: { Cookie: "oauth_state=qualquer; Path=/; HttpOnly; Secure; SameSite=Lax" } });
    const ctx = makeContext({ request: req, env });
    const res = await h.getCallback(ctx);
    assert.equal(res.status, 302);
    const location = res.headers.get("Location");
    assert.ok(location.includes("login=error"));
    assert.ok(location.includes("reason=token_exchange_failed"));
  });

  it("GET /api/auth/me anônimo retorna { ok: true, user: null }", async () => {
    const req = makeRequest("/api/auth/me");
    const ctx = makeContext({ request: req, env });
    const res = await h.getMe(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.equal(data.user, null);
  });

  it("GET /api/auth/me com sessão válida retorna dados do usuário", async () => {
    const user = { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/embed/avatars/0.png" };
    const req = makeRequest("/api/auth/me", { cookies: { receitas_session: await sessionCookie(env, user) } });
    const ctx = makeContext({ request: req, env });
    const res = await h.getMe(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    assert.deepEqual(data.user, { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/embed/avatars/0.png" });
  });

  it("POST /api/auth/logout expira cookie (Max-Age=0)", async () => {
    const req = makeRequest("/api/auth/logout", { method: "POST" });
    const ctx = makeContext({ request: req, env });
    const res = await h.postLogout(ctx);
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.ok(data.ok);
    const cookie = res.headers.get("Set-Cookie");
    assert.ok(cookie.includes("Max-Age=0"));
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("Secure"));
  });

  it("GET /api/auth/logout retorna 405", async () => {
    const req = makeRequest("/api/auth/logout", { method: "GET" });
    const ctx = makeContext({ request: req, env });
    const logoutModule = await import("../functions/api/auth/logout.js");
    const res = await logoutModule.onRequest(ctx);
    assert.equal(res.status, 405);
  });
});