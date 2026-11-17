/**
 * Testes das Cloudflare Pages Functions. Rode, dentro da pasta do projeto: node --test
 * (nao use "node --test tests/": no Node 22 a pasta e tratada como modulo e da MODULE_NOT_FOUND).
 * Zero dependencias: usa node:test, node:sqlite e Web Crypto nativos do Node >= 22.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createD1 } from "./d1-shim.mjs";
import * as activities from "../functions/api/activities.js";
import * as summary from "../functions/api/summary.js";
import * as status from "../functions/api/status.js";
import * as discordStart from "../functions/api/auth/discord.js";
import * as discordCallback from "../functions/api/auth/discord/callback.js";
import * as logout from "../functions/api/auth/logout.js";
import { createSessionToken, getSessionUser, SESSION_COOKIE, STATE_COOKIE } from "../functions/_utils.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://exemplo.pages.dev";
const CHAVE = "P26-3A-3337-3158-1523-6DA7";

function makeEnv(extra = {}) {
  return { DB: createD1(), DISCORD_CLIENT_ID: "123456789", DISCORD_CLIENT_SECRET: "segredo-de-teste", ...extra };
}

async function cookieFor(env, userId = "111111111111111111", username = "Aluno A") {
  const token = await createSessionToken({ userId, username, avatar: null }, env);
  return `${SESSION_COOKIE}=${token}`;
}

function req(pathname, { method = "GET", cookie, body, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  if (body !== undefined) h["Content-Type"] = "application/json";
  return new Request(ORIGIN + pathname, {
    method,
    headers: h,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const call = (mod, env, request) => mod.onRequest({ request, env });
const post = (env, cookie, body, headers) =>
  call(activities, env, req("/api/activities", { method: "POST", cookie, body, headers }));
const valid = (over = {}) => ({
  category: "ensino",
  title: "Curso de Python",
  hours: 10,
  certificateUrl: "https://certificados.exemplo.com/abc",
  ...over,
});

/* ---------- Autenticação e sessão ---------- */

test("rotas protegidas retornam 401 sem sessão", async () => {
  const env = makeEnv();
  for (const [mod, p, m] of [
    [activities, "/api/activities", "GET"],
    [activities, "/api/activities", "POST"],
    [activities, "/api/activities?id=1", "DELETE"],
    [summary, "/api/summary", "GET"],
  ]) {
    const res = await call(mod, env, req(p, { method: m, body: m === "POST" ? valid() : undefined }));
    assert.equal(res.status, 401, `${m} ${p}`);
  }
});

test("cookie forjado no formato antigo (base64 de JSON sem assinatura) é rejeitado", async () => {
  const env = makeEnv();
  const forged = btoa(encodeURIComponent(JSON.stringify({ userId: "999999999", username: "Hacker", avatar: "" })));
  const res = await call(activities, env, req("/api/activities", { cookie: `${SESSION_COOKIE}=${forged}` }));
  assert.equal(res.status, 401);
});

test("cookie com assinatura adulterada ou assinado com outro segredo é rejeitado", async () => {
  const env = makeEnv();
  const good = await cookieFor(env);
  const [name, token] = good.split("=");
  const [payload, sig] = token.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ uid: "222222222", un: "Outro", av: null, exp: 9999999999 })).toString("base64url");
  assert.equal((await call(summary, env, req("/api/summary", { cookie: `${name}=${tamperedPayload}.${sig}` }))).status, 401);
  assert.equal((await call(summary, env, req("/api/summary", { cookie: `${name}=${payload}.${sig.slice(0, -2)}AA` }))).status, 401);
  const other = makeEnv({ DISCORD_CLIENT_SECRET: "outro-segredo" });
  assert.equal((await call(summary, env, req("/api/summary", { cookie: await cookieFor(other) }))).status, 401);
});

test("cookie expirado é rejeitado", async () => {
  const env = makeEnv();
  const old = await createSessionToken({ userId: "111111111111111111", username: "A", avatar: null }, env, Date.now() - 3 * 24 * 3600 * 1000);
  const user = await getSessionUser(req("/", { cookie: `${SESSION_COOKIE}=${old}` }), env);
  assert.equal(user, null);
});

test("sem segredo configurado nenhuma sessão é aceita", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const noSecret = { DB: env.DB };
  assert.equal((await call(summary, noSecret, req("/api/summary", { cookie }))).status, 401);
});

test("SESSION_SECRET dedicado tem prioridade sobre DISCORD_CLIENT_SECRET", async () => {
  const env = makeEnv({ SESSION_SECRET: "segredo-de-sessao" });
  const cookie = await cookieFor(env);
  assert.equal((await call(summary, env, req("/api/summary", { cookie }))).status, 200);
  const withoutDedicated = { ...env, SESSION_SECRET: undefined };
  assert.equal((await call(summary, withoutDedicated, req("/api/summary", { cookie }))).status, 401);
});

/* ---------- Validações do servidor ---------- */

test("POST válido grava e aparece em GET/summary", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const res = await post(env, cookie, valid({ hours: 12.5 }));
  assert.equal(res.status, 201);
  const list = await (await call(activities, env, req("/api/activities", { cookie }))).json();
  assert.equal(list.activities.length, 1);
  assert.equal(list.activities[0].hours, 12.5);
  const sum = await (await call(summary, env, req("/api/summary", { cookie }))).json();
  assert.equal(sum.totals.ensino, 12.5);
  assert.equal(sum.remaining.ensino, 47.5);
  assert.equal(sum.total, 12.5);
  assert.equal(sum.remainingTotal, 167.5);
});

test("payloads inválidos retornam 400 e nada é gravado", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const bad = [
    valid({ category: "lazer" }),
    valid({ category: "" }),
    valid({ category: undefined }),
    valid({ title: "   " }),
    valid({ hours: 0 }),
    valid({ hours: -5 }),
    valid({ hours: "abc" }),
    valid({ hours: "" }),
    valid({ hours: null }),
    valid({ hours: true }),
    valid({ hours: [5] }),
    valid({ hours: NaN }),
    valid({ hours: 0.001 }),
    valid({ certificateUrl: "javascript:alert(1)" }),
    valid({ certificateUrl: "ftp://x.com/a" }),
    valid({ certificateUrl: "não é url" }),
    valid({ certificateUrl: "" }),
    "isto não é json",
    "null",
    "[1,2]",
  ];
  for (const b of bad) {
    const res = await post(env, cookie, b);
    assert.equal(res.status, 400, JSON.stringify(b));
  }
  const count = env.DB._raw.prepare("SELECT COUNT(*) AS n FROM activities").get().n;
  assert.equal(count, 0);
});

test("aceita 'Extensão' com acento e horas como string decimal", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const res = await post(env, cookie, valid({ category: "Extensão", hours: "7,5" }));
  assert.equal(res.status, 201);
  const row = env.DB._raw.prepare("SELECT category, hours FROM activities").get();
  assert.equal(row.category, "extensao");
  assert.equal(row.hours, 7.5);
});

test("não é possível gravar em nome de outro usuário (user_id vem só da sessão)", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env, "111111111111111111");
  await post(env, cookie, { ...valid(), userId: "999999999", user_id: "999999999", username: "Hacker" });
  const row = env.DB._raw.prepare("SELECT user_id, username FROM activities").get();
  assert.equal(row.user_id, "111111111111111111");
  assert.equal(row.username, "Aluno A");
});

/* ---------- Regra de negócio: teto por categoria ---------- */

test("teto de 60h por categoria: aceita até 60 e bloqueia o excedente com 409", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  assert.equal((await post(env, cookie, valid({ hours: 40 }))).status, 201);
  assert.equal((await post(env, cookie, valid({ hours: 20 }))).status, 201); // exatamente 60
  const over = await post(env, cookie, valid({ hours: 0.5 }));
  assert.equal(over.status, 409);
  assert.equal((await over.json()).available, 0);
  // outra categoria continua livre
  assert.equal((await post(env, cookie, valid({ category: "pesquisa", hours: 60 }))).status, 201);
  const sum = await (await call(summary, env, req("/api/summary", { cookie }))).json();
  assert.equal(sum.totals.ensino, 60);
  assert.equal(sum.totals.pesquisa, 60);
});

test("uma única atividade acima do teto (61h) é rejeitada", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  assert.equal((await post(env, cookie, valid({ hours: 61 }))).status, 409);
  assert.equal((await post(env, cookie, valid({ hours: 1e9 }))).status, 409);
});

test("soma fracionária no limite (ex.: 0,1 + 0,2 + ...) não gera falso bloqueio", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  for (let i = 0; i < 600; i++) {
    const r = await post(env, cookie, valid({ hours: 0.1 }));
    assert.equal(r.status, 201, `iteração ${i}`);
  }
  assert.equal((await post(env, cookie, valid({ hours: 0.01 }))).status, 409);
});

test("requisições concorrentes não ultrapassam o teto", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const results = await Promise.all(Array.from({ length: 8 }, () => post(env, cookie, valid({ hours: 20 }))));
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
  const total = env.DB._raw.prepare("SELECT SUM(hours) AS t FROM activities").get().t;
  assert.equal(total, 60);
});

test("teto é por usuário: outro estudante tem seus próprios 60h", async () => {
  const env = makeEnv();
  const a = await cookieFor(env, "111111111111111111", "A");
  const b = await cookieFor(env, "222222222222222222", "B");
  assert.equal((await post(env, a, valid({ hours: 60 }))).status, 201);
  assert.equal((await post(env, b, valid({ hours: 60 }))).status, 201);
});

test("integralização: 3 eixos x 60h = 180h, falta 0", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  for (const category of ["ensino", "pesquisa", "extensao"]) {
    assert.equal((await post(env, cookie, valid({ category, hours: 60 }))).status, 201);
  }
  const sum = await (await call(summary, env, req("/api/summary", { cookie }))).json();
  assert.equal(sum.total, 180);
  assert.equal(sum.required, 180);
  assert.equal(sum.remainingTotal, 0);
});

/* ---------- Isolamento, DELETE e CSRF ---------- */

test("usuário só lista e remove as próprias atividades", async () => {
  const env = makeEnv();
  const a = await cookieFor(env, "111111111111111111", "A");
  const b = await cookieFor(env, "222222222222222222", "B");
  await post(env, a, valid());
  const id = env.DB._raw.prepare("SELECT id FROM activities").get().id;

  const listB = await (await call(activities, env, req("/api/activities", { cookie: b }))).json();
  assert.equal(listB.activities.length, 0);

  const delB = await call(activities, env, req(`/api/activities?id=${id}`, { method: "DELETE", cookie: b }));
  assert.equal(delB.status, 404);
  assert.equal(env.DB._raw.prepare("SELECT COUNT(*) AS n FROM activities").get().n, 1);

  const delA = await call(activities, env, req(`/api/activities?id=${id}`, { method: "DELETE", cookie: a }));
  assert.equal(delA.status, 200);
  assert.equal(env.DB._raw.prepare("SELECT COUNT(*) AS n FROM activities").get().n, 0);
});

test("DELETE com id inválido retorna 400", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  for (const id of ["", "abc", "1 OR 1=1", "-1", "1;DROP TABLE activities"]) {
    const res = await call(activities, env, req(`/api/activities?id=${encodeURIComponent(id)}`, { method: "DELETE", cookie }));
    assert.equal(res.status, 400, id);
  }
});

test("injeção de SQL em título/URL é tratada como texto (queries parametrizadas)", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const evil = "x'); DROP TABLE activities; --";
  assert.equal((await post(env, cookie, valid({ title: evil }))).status, 201);
  const row = env.DB._raw.prepare("SELECT title FROM activities").get();
  assert.equal(row.title, evil);
});

test("escrita com Origin de outro site é bloqueada (403)", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const res = await post(env, cookie, valid(), { Origin: "https://malicioso.example" });
  assert.equal(res.status, 403);
  const ok = await post(env, cookie, valid(), { Origin: ORIGIN });
  assert.equal(ok.status, 201);
});

test("métodos não suportados retornam 405", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  assert.equal((await call(activities, env, req("/api/activities", { method: "PUT", cookie, body: {} }))).status, 405);
  assert.equal((await call(summary, env, req("/api/summary", { method: "POST", cookie, body: {} }))).status, 405);
  assert.equal((await call(status, env, req("/api/status", { method: "POST", body: {} }))).status, 405);
});

/* ---------- Status ---------- */

test("/api/status expõe chave, D1 e usuário da sessão (sem dados de terceiros)", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  const data = await (await call(status, env, req("/api/status", { cookie }))).json();
  assert.equal(data.chave, CHAVE);
  assert.equal(data.d1Connected, true);
  assert.equal(data.discordOAuthConfigured, true);
  assert.equal(data.sessionUser.userId, "111111111111111111");
  assert.equal("totalAtividades" in data, false);
  const anon = await (await call(status, env, req("/api/status"))).json();
  assert.equal(anon.sessionUser, null);
});

/* ---------- OAuth2 Discord ---------- */

test("início do OAuth redireciona ao Discord com state e cookie de state", async () => {
  const env = makeEnv();
  const res = await discordStart.onRequestGet({ request: req("/api/auth/discord"), env });
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://discord.com/api/oauth2/authorize");
  assert.equal(loc.searchParams.get("client_id"), "123456789");
  assert.equal(loc.searchParams.get("scope"), "identify");
  assert.equal(loc.searchParams.get("redirect_uri"), ORIGIN + "/api/auth/discord/callback");
  const state = loc.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{32}$/);
  const setCookie = res.headers.getSetCookie().join("\n");
  assert.ok(setCookie.includes(`${STATE_COOKIE}=${state}`));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
});

test("sem credenciais do Discord o login responde 503 (sem modo demonstração)", async () => {
  const res = await discordStart.onRequestGet({ request: req("/api/auth/discord"), env: { DB: createD1() } });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("Set-Cookie"), null);
});

test("não existe rota de login de demonstração", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "functions/api/auth/demo.js")), false);
});

test("callback rejeita state ausente ou divergente (CSRF de login)", async () => {
  const env = makeEnv();
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error("não deveria chamar o Discord"); };
  try {
    const semState = await discordCallback.onRequestGet({ request: req("/api/auth/discord/callback?code=abc"), env });
    assert.match(semState.headers.get("Location"), /auth_error=invalid_state/);
    const errado = await discordCallback.onRequestGet({
      request: req("/api/auth/discord/callback?code=abc&state=aaa", { cookie: `${STATE_COOKIE}=bbb` }),
      env,
    });
    assert.match(errado.headers.get("Location"), /auth_error=invalid_state/);
    assert.equal(called, false);
    assert.ok(!errado.headers.getSetCookie().some((c) => c.startsWith(SESSION_COOKIE + "=") && !c.includes("Max-Age=0")));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("callback válido: importa user_id, nome e avatar, grava no D1 e cria sessão assinada", async () => {
  const env = makeEnv();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/oauth2/token")) {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("code"), "abc");
      assert.equal(body.get("redirect_uri"), ORIGIN + "/api/auth/discord/callback");
      return Response.json({ access_token: "tok" });
    }
    if (String(url).endsWith("/users/@me")) {
      assert.equal(init.headers.Authorization, "Bearer tok");
      return Response.json({ id: "80351110224678912", username: "nelly", global_name: "Nelly", avatar: "8342729096ea3675442027381ff50dfe" });
    }
    throw new Error("URL inesperada " + url);
  };
  try {
    const res = await discordCallback.onRequestGet({
      request: req("/api/auth/discord/callback?code=abc&state=xyz", { cookie: `${STATE_COOKIE}=xyz` }),
      env,
    });
    assert.equal(res.status, 302);
    assert.equal(new URL(res.headers.get("Location")).pathname + new URL(res.headers.get("Location")).search, "/?login=success");
    const cookies = res.headers.getSetCookie();
    const session = cookies.find((c) => c.startsWith(SESSION_COOKIE + "="));
    assert.ok(session && /HttpOnly/.test(session) && /Secure/.test(session) && /SameSite=Lax/.test(session));
    assert.ok(cookies.some((c) => c.startsWith(STATE_COOKIE + "=;") && /Max-Age=0/.test(c)));

    const user = await getSessionUser(req("/", { cookie: session.split(";")[0] }), env);
    assert.equal(user.userId, "80351110224678912");
    assert.equal(user.username, "Nelly");
    assert.equal(user.avatar, "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png");

    const row = env.DB._raw.prepare("SELECT * FROM discord_users").get();
    assert.equal(row.user_id, "80351110224678912");
    assert.equal(row.username, "Nelly");
    assert.match(row.avatar, /cdn\.discordapp\.com\/avatars/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("callback rejeita user id não numérico vindo do Discord", async () => {
  const env = makeEnv();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    String(url).endsWith("/oauth2/token") ? Response.json({ access_token: "t" }) : Response.json({ id: "../../x", username: "z" });
  try {
    const res = await discordCallback.onRequestGet({
      request: req("/api/auth/discord/callback?code=abc&state=s", { cookie: `${STATE_COOKIE}=s` }),
      env,
    });
    assert.match(res.headers.get("Location"), /auth_error=invalid_user/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("callback trata erro do Discord (usuário negou) sem criar sessão", async () => {
  const env = makeEnv();
  const res = await discordCallback.onRequestGet({ request: req("/api/auth/discord/callback?error=access_denied"), env });
  assert.match(res.headers.get("Location"), /auth_error=access_denied/);
  assert.ok(!res.headers.getSetCookie().some((c) => c.startsWith(SESSION_COOKIE + "=") && !c.includes("Max-Age=0")));
});

test("logout (POST) limpa o cookie de sessão; GET e outra origem não deslogam", async () => {
  const res = await logout.onRequestPost({ request: req("/api/auth/logout", { method: "POST" }) });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("Set-Cookie"), new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`));
  assert.equal(logout.onRequestGet, undefined, "logout não deve responder a GET (CSRF de logout)");
  const cross = await logout.onRequestPost({
    request: req("/api/auth/logout", { method: "POST", headers: { Origin: "https://malicioso.example" } }),
  });
  assert.equal(cross.status, 403);
  assert.equal(cross.headers.get("Set-Cookie"), null);
});

test("callback não repassa texto arbitrário do parâmetro error para a interface", async () => {
  const env = makeEnv();
  const res = await discordCallback.onRequestGet({
    request: req("/api/auth/discord/callback?error=" + encodeURIComponent("<b>sua conta foi bloqueada, ligue 0800")),
    env,
  });
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.searchParams.get("auth_error"), "oauth_error");
});

test("categoria só é aceita como string (array/objeto/número → 400)", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  for (const category of [["ensino"], { 0: "ensino" }, 1, true]) {
    assert.equal((await post(env, cookie, valid({ category }))).status, 400, JSON.stringify(category));
  }
});

test("horas com mais de 2 casas são rejeitadas (sem arredondar em silêncio)", async () => {
  const env = makeEnv();
  const cookie = await cookieFor(env);
  for (const hours of [0.335, 59.999, 10.001, "5.555", "5,555", 1e-7]) {
    assert.equal((await post(env, cookie, valid({ hours }))).status, 400, String(hours));
  }
  assert.equal((await post(env, cookie, valid({ hours: 59.99 }))).status, 201);
  assert.equal((await post(env, cookie, valid({ hours: 0.01 }))).status, 201); // fecha exatamente 60
  assert.equal((await post(env, cookie, valid({ hours: 0.01 }))).status, 409);
  assert.equal(env.DB._raw.prepare("SELECT SUM(hours) AS t FROM activities").get().t, 60);
});

/* ---------- Conformidade da entrega (rubrica) ---------- */

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("rodapé e README contêm a Chave Única; licença é MIT", () => {
  assert.match(read("public/index.html"), new RegExp(`<footer[^>]*>[\\s\\S]*${CHAVE}[\\s\\S]*</footer>`));
  assert.ok(read("README.md").includes(CHAVE));
  assert.match(read("LICENSE"), /MIT License/);
  assert.match(read("LICENSE"), /Permission is hereby granted, free of charge/);
});

test("front-end não usa frameworks de UI nem CDNs", () => {
  const html = read("public/index.html");
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(read("public/app.js"), /\b(React|Vue|Angular|Svelte|jQuery)\b/);
  assert.equal(fs.existsSync(path.join(ROOT, "package.json")), false);
});

test("CSS não usa text-shadow nem drop-shadow em texto", () => {
  const css = read("public/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css.replace(/text-shadow:\s*none\s*!important;/g, ""), /text-shadow|drop-shadow/);
});

test("AGENTS.md documenta >= 3 agentes, agente de teste e harness; skills existem", () => {
  const agents = read("AGENTS.md");
  const headings = agents.match(/^### Agente \d+/gm) || [];
  assert.ok(headings.length >= 3, `agentes: ${headings.length}`);
  assert.match(agents, /Teste/i);
  assert.match(agents, /Harness/i);
  const skillDirs = fs.readdirSync(path.join(ROOT, "skills"));
  assert.ok(skillDirs.length >= 3);
  for (const d of skillDirs) assert.ok(fs.existsSync(path.join(ROOT, "skills", d, "SKILL.md")), d);
  for (const m of agents.matchAll(/\(\.\/(skills\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), m[1]);
});
