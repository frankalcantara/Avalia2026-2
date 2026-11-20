/**
 * Testes de integração: chamam as Pages Functions reais (middleware + handlers)
 * contra um banco SQLite com a mesma migration do D1. Rodar: npm test
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadSqlite, createD1 } from "./helpers/d1-sqlite.mjs";
import { createSession } from "../src/lib/session.js";
import { addDays, utcToday } from "../src/lib/dates.js";

import * as middleware from "../functions/api/_middleware.js";
import * as me from "../functions/api/me.js";
import * as habits from "../functions/api/habits/index.js";
import * as habitById from "../functions/api/habits/[id].js";
import * as completion from "../functions/api/habits/[id]/completions/[date].js";
import * as metrics from "../functions/api/metrics.js";
import * as login from "../functions/api/auth/discord.js";
import * as callback from "../functions/api/auth/discord/callback.js";
import * as logout from "../functions/api/auth/logout.js";

const ORIGIN = "https://habitos.example.pages.dev";
const DatabaseSync = await loadSqlite();
const skip = DatabaseSync ? false : "node:sqlite indisponível nesta versão do Node";

// ---- mini-roteador com as mesmas regras de rota das Pages Functions ----
const routes = [
  [/^\/api\/me$/, me, []],
  [/^\/api\/metrics$/, metrics, []],
  [/^\/api\/auth\/discord$/, login, []],
  [/^\/api\/auth\/discord\/callback$/, callback, []],
  [/^\/api\/auth\/logout$/, logout, []],
  [/^\/api\/habits$/, habits, []],
  [/^\/api\/habits\/([^/]+)$/, habitById, ["id"]],
  [/^\/api\/habits\/([^/]+)\/completions\/([^/]+)$/, completion, ["id", "date"]],
];
const METHOD_EXPORT = { GET: "onRequestGet", POST: "onRequestPost", PUT: "onRequestPut", PATCH: "onRequestPatch", DELETE: "onRequestDelete" };

let env;
async function call(method, path, { cookie, body, headers = {}, rawBody, contentType } = {}) {
  const url = new URL(path, ORIGIN);
  const h = new Headers(headers);
  if (cookie) h.set("Cookie", cookie);
  let payload;
  if (body !== undefined) {
    h.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }
  if (rawBody !== undefined) {
    payload = rawBody;
    if (contentType) h.set("Content-Type", contentType);
  }
  const request = new Request(url, { method, headers: h, body: payload });

  let mod, params = {};
  for (const [re, m, names] of routes) {
    const match = re.exec(url.pathname);
    if (match) {
      mod = m;
      names.forEach((n, i) => (params[n] = decodeURIComponent(match[i + 1])));
      break;
    }
  }
  assert.ok(mod, `rota não encontrada: ${url.pathname}`);
  const context = { request, env, params, data: {} };
  context.next = async () => {
    const fn = mod[METHOD_EXPORT[method]];
    if (!fn) return new Response(null, { status: 405 });
    return fn(context);
  };
  const res = await middleware.onRequest(context);
  const type = res.headers.get("Content-Type") || "";
  const json = type.includes("application/json") ? await res.json() : null;
  return { res, json };
}

async function loginAs(userId, username = "aluno") {
  await env.DB.prepare("INSERT OR IGNORE INTO users (user_id, username, avatar_url) VALUES (?, ?, ?)")
    .bind(userId, username, "https://cdn.discordapp.com/embed/avatars/0.png")
    .run();
  const setCookie = await createSession(env.DB, userId, new Request(ORIGIN));
  return setCookie.split(";")[0]; // "ht_session=<token>"
}

const TODAY = utcToday();
const q = `today=${TODAY}`;

before(() => {
  if (!DatabaseSync) return;
  env = { DB: createD1(DatabaseSync), DISCORD_CLIENT_ID: "123456789", DISCORD_CLIENT_SECRET: "segredo" };
});

test("sem sessão: rotas protegidas respondem 401", { skip }, async () => {
  for (const [m, p] of [["GET", "/api/me"], ["GET", "/api/habits"], ["GET", "/api/metrics"], ["POST", "/api/habits"], ["PUT", `/api/habits/1/completions/${TODAY}`]]) {
    const { res } = await call(m, p, m === "POST" ? { body: { name: "x" } } : {});
    assert.equal(res.status, 401, `${m} ${p}`);
  }
});

test("sessão forjada ou expirada não autentica", { skip }, async () => {
  assert.equal((await call("GET", "/api/me", { cookie: "ht_session=inventado" })).res.status, 401);
  const cookie = await loginAs("200000000000000001");
  await env.DB.prepare("UPDATE sessions SET expires_at = 0 WHERE user_id = ?").bind("200000000000000001").run();
  assert.equal((await call("GET", "/api/me", { cookie })).res.status, 401);
});

test("sem binding DB: erro claro de configuração", { skip }, async () => {
  const saved = env;
  env = { ...saved, DB: undefined };
  const { res, json } = await call("GET", "/api/me");
  env = saved;
  assert.equal(res.status, 500);
  assert.equal(json.error, "d1_not_configured");
});

test("OAuth2: /api/auth/discord redireciona ao Discord com state e escopo identify", { skip }, async () => {
  const { res } = await call("GET", "/api/auth/discord");
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(loc.searchParams.get("client_id"), "123456789");
  assert.equal(loc.searchParams.get("scope"), "identify");
  assert.equal(loc.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/discord/callback`);
  const state = loc.searchParams.get("state");
  assert.ok(state && state.length >= 16);
  assert.match(res.headers.get("Set-Cookie"), new RegExp(`ht_oauth_state=${state}.*HttpOnly.*Secure`));
});

test("OAuth2: sem credenciais no ambiente avisa not_configured", { skip }, async () => {
  const saved = env;
  env = { DB: saved.DB };
  const { res } = await call("GET", "/api/auth/discord");
  env = saved;
  assert.equal(res.headers.get("Location"), "/?auth_error=not_configured");
});

test("OAuth2: callback com state inválido é recusado", { skip }, async () => {
  const { res } = await call("GET", "/api/auth/discord/callback?code=abc&state=xyz", { cookie: "ht_oauth_state=outro" });
  assert.equal(res.headers.get("Location"), "/?auth_error=invalid_state");
});

test("OAuth2: callback importa user_id, nome e avatar no D1 e cria sessão", { skip }, async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).endsWith("/oauth2/token")) {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("client_secret"), "segredo");
      assert.equal(form.get("code"), "codigo-ok");
      return Response.json({ access_token: "tok", token_type: "Bearer" });
    }
    if (String(url).endsWith("/users/@me")) {
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer tok");
      return Response.json({ id: "80351110224678912", username: "henry", global_name: "Henry", avatar: "8342729096ea3675442027381ff50dfe" });
    }
    return new Response("not found", { status: 404 });
  };
  try {
    const { res } = await call("GET", "/api/auth/discord/callback?code=codigo-ok&state=s123", { cookie: "ht_oauth_state=s123" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("Location"), "/");
    const cookies = res.headers.getSetCookie();
    const session = cookies.find((c) => c.startsWith("ht_session="));
    assert.ok(session, "cookie de sessão emitido");
    assert.match(session, /HttpOnly/);
    assert.deepEqual(calls.length, 2);

    const row = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind("80351110224678912").first();
    assert.equal(row.username, "henry");
    assert.equal(row.display_name, "Henry");
    assert.match(row.avatar_url, /avatars\/80351110224678912\/8342729096ea3675442027381ff50dfe\.png/);

    const { json } = await call("GET", "/api/me", { cookie: session.split(";")[0] });
    assert.deepEqual(json.user, {
      userId: "80351110224678912",
      username: "henry",
      displayName: "Henry",
      avatarUrl: row.avatar_url,
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("hábitos: criar, validar e impedir duplicados", { skip }, async () => {
  const cookie = await loginAs("300000000000000001");
  const ok = await call("POST", "/api/habits", { cookie, body: { name: "  Beber  água ", color: "ciano" } });
  assert.equal(ok.res.status, 201);
  assert.equal(ok.json.habit.name, "Beber água");
  assert.equal(ok.json.habit.color, "ciano");

  assert.equal((await call("POST", "/api/habits", { cookie, body: { name: "BEBER ÁGUA" } })).res.status, 409, "maiúsculas acentuadas");
  assert.equal((await call("POST", "/api/habits", { cookie, body: { name: "beber água" } })).res.status, 409);
  assert.equal((await call("POST", "/api/habits", { cookie, body: { name: "" } })).res.status, 422);
  assert.equal((await call("POST", "/api/habits", { cookie, body: { name: "Correr", color: "#000" } })).res.status, 422);
  assert.equal((await call("POST", "/api/habits", { cookie, rawBody: "name=x", contentType: "application/x-www-form-urlencoded" })).res.status, 415);
  assert.equal((await call("POST", "/api/habits", { cookie, rawBody: "{oops", contentType: "application/json" })).res.status, 400);
});

test("hábitos: limite por usuário", { skip }, async () => {
  const cookie = await loginAs("300000000000000002");
  for (let i = 0; i < 30; i++) {
    assert.equal((await call("POST", "/api/habits", { cookie, body: { name: `Hábito ${i}` } })).res.status, 201);
  }
  const over = await call("POST", "/api/habits", { cookie, body: { name: "Mais um" } });
  assert.equal(over.res.status, 409);
  assert.equal(over.json.error, "habit_limit");
});

test("requisição de outra origem que altera dados é bloqueada (CSRF)", { skip }, async () => {
  const cookie = await loginAs("300000000000000003");
  const { res } = await call("POST", "/api/habits", { cookie, body: { name: "x" }, headers: { Origin: "https://malicioso.example" } });
  assert.equal(res.status, 403);
});

test("marcações: métricas recalculadas no servidor (streak atual, máximo e taxa)", { skip }, async () => {
  const cookie = await loginAs("400000000000000001");
  const { json: created } = await call("POST", "/api/habits", { cookie, body: { name: "Ler" } });
  const id = created.habit.id;

  const days = [addDays(TODAY, -2), addDays(TODAY, -1), TODAY];
  let last;
  for (const d of days) {
    last = await call("PUT", `/api/habits/${id}/completions/${d}?${q}`, { cookie });
    assert.equal(last.res.status, 200);
  }
  const m = last.json.habit.metrics;
  assert.equal(m.currentStreak, 3);
  assert.equal(m.maxStreak, 3);
  assert.equal(m.doneToday, true);
  const inMonth = days.filter((d) => d.slice(0, 7) === TODAY.slice(0, 7)).length;
  assert.equal(m.completedDays, inMonth);
  // hábito criado hoje com marcações retroativas: a base começa na primeira marcação do mês
  assert.equal(m.eligibleDays, inMonth);
  assert.equal(m.monthlyRate, Math.round((inMonth / m.eligibleDays) * 1000) / 10);
  assert.equal(last.json.summary.bestMaxStreak, 3);

  // PUT é idempotente: repetir não duplica
  const again = await call("PUT", `/api/habits/${id}/completions/${TODAY}?${q}`, { cookie });
  assert.equal(again.json.habit.metrics.completedDays, inMonth);

  // desmarcar o dia do meio quebra a sequência
  const del = await call("DELETE", `/api/habits/${id}/completions/${addDays(TODAY, -1)}?${q}`, { cookie });
  assert.equal(del.json.habit.metrics.currentStreak, 1);
  assert.equal(del.json.habit.metrics.maxStreak, 1);

  // GET /api/metrics devolve o mesmo cálculo
  const met = await call("GET", `/api/metrics?${q}`, { cookie });
  assert.equal(met.json.habits[0].currentStreak, 1);
  assert.equal(met.json.summary.habits, 1);
});

test("marcações: regras de negócio no servidor", { skip }, async () => {
  const cookie = await loginAs("500000000000000001");
  const other = await loginAs("500000000000000002");
  const { json } = await call("POST", "/api/habits", { cookie, body: { name: "Meditar" } });
  const id = json.habit.id;

  assert.equal((await call("PUT", `/api/habits/${id}/completions/${addDays(TODAY, 2)}?${q}`, { cookie })).res.status, 422, "futuro");
  assert.equal((await call("PUT", `/api/habits/${id}/completions/2026-02-30?${q}`, { cookie })).res.status, 422, "data inexistente");
  assert.equal((await call("PUT", `/api/habits/${id}/completions/hoje?${q}`, { cookie })).res.status, 422, "formato");
  assert.equal((await call("PUT", `/api/habits/abc/completions/${TODAY}?${q}`, { cookie })).res.status, 400, "id inválido");
  assert.equal((await call("PUT", `/api/habits/999999/completions/${TODAY}?${q}`, { cookie })).res.status, 404, "inexistente");
  assert.equal((await call("PUT", `/api/habits/${id}/completions/${TODAY}?${q}`, { cookie: other })).res.status, 404, "hábito de outro usuário");
  assert.equal((await call("PATCH", `/api/habits/${id}`, { cookie: other, body: { name: "hack" } })).res.status, 404);
  assert.equal((await call("DELETE", `/api/habits/${id}`, { cookie: other })).res.status, 404);
  // "today" do cliente muito distante do relógio do servidor é ignorado
  assert.equal((await call("PUT", `/api/habits/${id}/completions/${addDays(TODAY, 5)}?today=${addDays(TODAY, 5)}`, { cookie })).res.status, 422);
});

test("painel do mês: mês futuro é recusado, mês passado é aceito", { skip }, async () => {
  const cookie = await loginAs("600000000000000001");
  const [y, m] = TODAY.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  assert.equal((await call("GET", `/api/habits?month=${next}&${q}`, { cookie })).res.status, 400);
  const past = await call("GET", `/api/habits?month=${prev}&${q}`, { cookie });
  assert.equal(past.res.status, 200);
  assert.equal(past.json.month, prev);
});

test("editar e excluir hábito (exclusão remove as marcações)", { skip }, async () => {
  const cookie = await loginAs("700000000000000001");
  const a = (await call("POST", "/api/habits", { cookie, body: { name: "Alongar" } })).json.habit.id;
  await call("POST", "/api/habits", { cookie, body: { name: "Correr" } });
  await call("PUT", `/api/habits/${a}/completions/${TODAY}?${q}`, { cookie });

  const p = await call("PATCH", `/api/habits/${a}`, { cookie, body: { name: "Alongar 10 min", color: "roxo" } });
  assert.equal(p.res.status, 200);
  assert.equal(p.json.habit.color, "roxo");
  assert.equal((await call("PATCH", `/api/habits/${a}`, { cookie, body: { name: "correr" } })).res.status, 409);
  assert.equal((await call("PATCH", `/api/habits/${a}`, { cookie, body: {} })).res.status, 422);

  assert.equal((await call("DELETE", `/api/habits/${a}`, { cookie })).res.status, 200);
  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM completions WHERE habit_id = ?").bind(a).first();
  assert.equal(left.n, 0);
  const list = await call("GET", `/api/habits?${q}`, { cookie });
  assert.deepEqual(list.json.habits.map((h) => h.name), ["Correr"]);
});

test("logout invalida a sessão no servidor", { skip }, async () => {
  const cookie = await loginAs("800000000000000001");
  assert.equal((await call("GET", "/api/me", { cookie })).res.status, 200);
  const out = await call("POST", "/api/auth/logout", { cookie });
  assert.match(out.res.headers.get("Set-Cookie"), /ht_session=;.*Max-Age=0/);
  assert.equal((await call("GET", "/api/me", { cookie })).res.status, 401);
});
