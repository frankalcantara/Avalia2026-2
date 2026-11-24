import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession } from "../functions/_lib/session.js";
import * as me from "../functions/api/me.js";
import * as logout from "../functions/api/auth/logout.js";
import * as authStart from "../functions/api/auth/discord.js";
import * as callback from "../functions/api/auth/discord/callback.js";
import * as create from "../functions/api/quotes/index.js";
import * as byId from "../functions/api/quotes/[id].js";
import * as mine from "../functions/api/quotes/mine.js";
import * as feed from "../functions/api/quotes/feed.js";
import * as random from "../functions/api/quotes/random.js";
import * as apiCatchAll from "../functions/api/[[path]].js";
import * as status from "../functions/api/status.js";

const ORIGIN = "https://acervo.example";
const SECRET = "segredo-de-teste";

// ---- mock mínimo de D1 (casa por trechos do SQL) ----
function mockDB() {
  const users = new Map();
  const quotes = [];
  let seq = 0;
  const join = (q) => ({ ...q, owner_username: users.get(q.user_id)?.username, owner_avatar: users.get(q.user_id)?.avatar ?? null });
  const run = (sql, a) => {
    if (sql.startsWith("INSERT INTO discord_users")) {
      const [id, username, avatar] = a;
      if (!/DO NOTHING/.test(sql) || !users.has(id)) users.set(id, { username, avatar });
      return { meta: {} };
    }
    if (sql.startsWith("INSERT INTO quotes")) {
      const [user_id, text, author, work, page, reflection, is_public] = a;
      const q = { id: ++seq, user_id, text, author, work, page, reflection, is_public, created_at: "t", updated_at: null };
      quotes.push(q);
      return { meta: { last_row_id: q.id } };
    }
    if (sql.startsWith("UPDATE quotes")) {
      const [text, author, work, page, reflection, is_public, id, uid] = a;
      const q = quotes.find((x) => x.id === id && x.user_id === uid);
      if (q) Object.assign(q, { text, author, work, page, reflection, is_public, updated_at: "t2" });
      return { meta: {} };
    }
    if (sql.startsWith("DELETE FROM quotes")) {
      const i = quotes.findIndex((x) => x.id === a[0] && x.user_id === a[1]);
      if (i >= 0) quotes.splice(i, 1);
      return { meta: {} };
    }
    return { meta: {} };
  };
  const query = (sql, a) => {
    if (sql.startsWith("SELECT user_id")) return [quotes.find((x) => x.id === a[0])].filter(Boolean);
    if (sql.includes("WHERE q.id = ?")) return [quotes.find((x) => x.id === a[0])].filter(Boolean).map(join);
    if (sql.includes("ORDER BY RANDOM()")) {
      assert.match(sql, /q\.is_public = 1/);
      const pub = quotes.filter((x) => x.is_public === 1);
      return pub.slice(0, 1).map(join);
    }
    if (sql.includes("ORDER BY q.id DESC")) {
      let i = 0;
      let rows = [...quotes];
      for (const c of sql.match(/WHERE (q\..*) ORDER BY/)[1].split(" AND ")) {
        if (c === "q.user_id = ?") { const v = a[i++]; rows = rows.filter((x) => x.user_id === v); }
        else if (c === "q.is_public = ?") { const v = a[i++]; rows = rows.filter((x) => x.is_public === v); }
        else if (c === "q.is_public = 1") rows = rows.filter((x) => x.is_public === 1);
        else if (c === "q.id < ?") { const v = a[i++]; rows = rows.filter((x) => x.id < v); }
      }
      const limit = a[a.length - 1];
      return rows.sort((x, y) => y.id - x.id).slice(0, limit).map(join);
    }
    return [];
  };
  return {
    users, quotes,
    prepare(sql) {
      const mk = (a) => ({
        run: async () => run(sql, a),
        first: async () => query(sql, a)[0] ?? null,
        all: async () => ({ results: query(sql, a) }),
      });
      return { ...mk([]), bind: (...a) => mk(a) };
    },
  };
}

const mkEnv = () => ({ DB: mockDB(), SESSION_SECRET: SECRET, DISCORD_CLIENT_ID: "cid", DISCORD_CLIENT_SECRET: "csec" });
const cookieFor = async (userId, username = userId) => `discord_session=${await signSession({ userId, username, avatar: null }, SECRET)}`;
const req = (path, { method = "GET", cookie, body, headers = {} } = {}) =>
  new Request(ORIGIN + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const call = (mod, request, env, params = {}) => (mod.onRequest || mod.onRequestGet)({ request, env, params });
const good = { text: "Trecho", author: "Autor", work: "Obra", page: "12", reflection: "Pensei", visibility: "public" };

test("sessão assinada: válida, adulterada e expirada", async () => {
  const t = await signSession({ userId: "1", username: "a", avatar: null }, SECRET);
  assert.equal((await verifySession(t, SECRET)).userId, "1");
  const [b, s] = t.split(".");
  const forged = btoa(JSON.stringify({ u: "2", n: "x", a: null, exp: 9999999999 })).replace(/=+$/, "");
  assert.equal(await verifySession(`${forged}.${s}`, SECRET), null);
  assert.equal(await verifySession(`${b}.${s[0] === "A" ? "B" : "A"}${s.slice(1)}`, SECRET), null);
  assert.equal(await verifySession(t, "outro-segredo"), null);
  assert.equal(await verifySession(t, SECRET, Date.now() + 8 * 86400 * 1000), null);
  assert.equal(await verifySession(btoa(encodeURIComponent('{"userId":"1"}')), SECRET), null);
});

test("/api/me: 200 com sessão, 401 sem ou adulterada", async () => {
  const env = mkEnv();
  const ok = await call(me, req("/api/me", { cookie: await cookieFor("1", "ana") }), env);
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).user, { userId: "1", username: "ana", avatar: null });
  assert.equal((await call(me, req("/api/me"), env)).status, 401);
  const bad = (await cookieFor("1")).slice(0, -3) + "xyz";
  assert.equal((await call(me, req("/api/me", { cookie: bad }), env)).status, 401);
  assert.equal((await call(me, req("/api/me", { method: "POST" }), env)).status, 405);
});

test("respostas JSON trazem cabeçalhos de segurança", async () => {
  const r = await call(me, req("/api/me"), mkEnv());
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(r.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.match(r.headers.get("Content-Type"), /^application\/json/);
});

test("logout limpa o cookie; GET => 405", async () => {
  const r = await call(logout, req("/api/auth/logout", { method: "POST" }), mkEnv());
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Set-Cookie"), /discord_session=;.*Max-Age=0.*Secure/);
  assert.equal((await call(logout, req("/api/auth/logout"), mkEnv())).status, 405);
});

test("401 sem sessão nos endpoints protegidos", async () => {
  const env = mkEnv();
  assert.equal((await call(create, req("/api/quotes", { method: "POST", body: good }), env)).status, 401);
  assert.equal((await call(mine, req("/api/quotes/mine"), env)).status, 401);
  assert.equal((await call(feed, req("/api/quotes/feed"), env)).status, 401);
  assert.equal((await call(byId, req("/api/quotes/1", { method: "DELETE" }), env, { id: "1" })).status, 401);
});

test("POST /api/quotes: 400 com fields, 415, 413, 201 e dono vem da sessão", async () => {
  const env = mkEnv();
  const cookie = await cookieFor("u1", "ana");
  let r = await call(create, req("/api/quotes", { method: "POST", cookie, body: { text: "", author: " ", page: "-3", visibility: "x", work: "w".repeat(301) } }), env);
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.equal(j.ok, false);
  for (const f of ["text", "author", "page", "visibility", "work"]) assert.ok(j.fields[f], f);
  r = await call(create, new Request(ORIGIN + "/api/quotes", { method: "POST", headers: { Cookie: cookie, "Content-Type": "text/plain" }, body: "x" }), env);
  assert.equal(r.status, 415);
  r = await call(create, req("/api/quotes", { method: "POST", cookie, body: JSON.stringify({ text: "a".repeat(40000), author: "b" }) }), env);
  assert.equal(r.status, 413);
  r = await call(create, req("/api/quotes", { method: "POST", cookie, body: "{nope" }), env);
  assert.equal(r.status, 400);
  r = await call(create, req("/api/quotes", { method: "POST", cookie, headers: { Origin: "https://evil.example" }, body: good }), env);
  assert.equal(r.status, 403);
  r = await call(create, req("/api/quotes", { method: "POST", cookie, body: { ...good, userId: "hacker", user_id: "hacker", owner: { userId: "hacker" } } }), env);
  assert.equal(r.status, 201);
  const q = (await r.json()).quote;
  assert.equal(q.owner.userId, "u1");
  assert.equal(q.page, 12);
  assert.equal(q.visibility, "public");
  // visibility padrão = private; page vazio = null
  r = await call(create, req("/api/quotes", { method: "POST", cookie, body: { text: "t", author: "a", page: "" } }), env);
  const q2 = (await r.json()).quote;
  assert.equal(q2.visibility, "private");
  assert.equal(q2.page, null);
});

test("403 ao editar/excluir citação alheia; 404 inexistente; dono consegue", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const b = await cookieFor("B");
  const { quote } = await (await call(create, req("/api/quotes", { method: "POST", cookie: a, body: good }), env)).json();
  const id = String(quote.id);
  assert.equal((await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: b, body: good }), env, { id })).status, 403);
  assert.equal((await call(byId, req("/api/quotes/" + id, { method: "DELETE", cookie: b }), env, { id })).status, 403);
  assert.equal(env.DB.quotes.length, 1);
  assert.equal((await call(byId, req("/api/quotes/999", { method: "DELETE", cookie: a }), env, { id: "999" })).status, 404);
  assert.equal((await call(byId, req("/api/quotes/abc", { method: "DELETE", cookie: a }), env, { id: "abc" })).status, 404);
  assert.equal((await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { text: "" } }), env, { id })).status, 400);
  const up = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { ...good, text: "Novo", visibility: "private" } }), env, { id });
  assert.equal(up.status, 200);
  assert.equal((await up.json()).quote.text, "Novo");
  assert.equal((await call(byId, req("/api/quotes/" + id, { method: "GET", cookie: a }), env, { id })).status, 405);
  assert.equal((await call(byId, req("/api/quotes/" + id, { method: "DELETE", cookie: a }), env, { id })).status, 200);
  assert.equal(env.DB.quotes.length, 0);
});

test("privadas nunca no feed nem no random; mine filtra por dono e visibilidade; paginação", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const b = await cookieFor("B");
  const post = (cookie, visibility, text) => call(create, req("/api/quotes", { method: "POST", cookie, body: { text, author: "x", visibility } }), env);
  await post(a, "private", "segredo-A");
  await post(b, "private", "segredo-B");
  // random sem públicas
  let r = await (await call(random, req("/api/quotes/random"), env)).json();
  assert.deepEqual(r, { ok: true, quote: null });
  for (let i = 0; i < 4; i++) await post(a, "public", "pub" + i);
  r = await (await call(random, req("/api/quotes/random"), env)).json();
  assert.equal(r.quote.visibility, "public");
  const f = await (await call(feed, req("/api/quotes/feed?limit=3", { cookie: b }), env)).json();
  assert.equal(f.quotes.length, 3);
  assert.ok(f.quotes.every((q) => q.visibility === "public" && q.owner.userId === "A"));
  assert.equal(f.nextCursor, f.quotes[2].id);
  const f2 = await (await call(feed, req("/api/quotes/feed?limit=3&cursor=" + f.nextCursor, { cookie: b }), env)).json();
  assert.equal(f2.quotes.length, 1);
  assert.equal(f2.nextCursor, null);
  const m = await (await call(mine, req("/api/quotes/mine", { cookie: b }), env)).json();
  assert.deepEqual(m.quotes.map((q) => q.text), ["segredo-B"]);
  const mp = await (await call(mine, req("/api/quotes/mine?visibility=public", { cookie: a }), env)).json();
  assert.ok(mp.quotes.length === 4 && mp.quotes.every((q) => q.visibility === "public"));
  assert.equal((await call(mine, req("/api/quotes/mine?visibility=zzz", { cookie: a }), env)).status, 400);
  assert.equal((await call(feed, req("/api/quotes/feed?cursor=abc", { cookie: a }), env)).status, 400);
});

test("OAuth: authorize gera state em cookie e na URL; sem config => configured:false", async () => {
  const r = await call(authStart, req("/api/auth/discord"), mkEnv());
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("Location"));
  assert.ok(loc.href.startsWith("https://discord.com/api/oauth2/authorize"));
  assert.equal(loc.searchParams.get("redirect_uri"), ORIGIN + "/api/auth/discord/callback");
  const state = loc.searchParams.get("state");
  assert.ok(state.length >= 24);
  const sc = r.headers.get("Set-Cookie");
  assert.ok(sc.includes(`discord_oauth_state=${state}`) && /HttpOnly/.test(sc) && /Secure/.test(sc));
  const noCfg = await call(authStart, req("/api/auth/discord"), {});
  assert.equal(noCfg.status, 302);
  assert.equal(noCfg.headers.get("Location"), "/?auth_error=server_misconfigured");
  const http = await call(authStart, new Request("http://localhost:8788/api/auth/discord"), mkEnv());
  assert.ok(!/Secure/.test(http.headers.get("Set-Cookie")));
});

test("OAuth callback: state ausente/errado, access_denied; sucesso com fetch mockado", async () => {
  const env = mkEnv();
  const loc = (r) => r.headers.get("Location");
  let r = await call(callback, req("/api/auth/discord/callback?code=abc&state=s1"), env);
  assert.equal(loc(r), "/?auth_error=invalid_state");
  r = await call(callback, req("/api/auth/discord/callback?code=abc&state=s1", { cookie: "discord_oauth_state=outro" }), env);
  assert.equal(loc(r), "/?auth_error=invalid_state");
  r = await call(callback, req("/api/auth/discord/callback?code=abc", { cookie: "discord_oauth_state=s1" }), env);
  assert.equal(loc(r), "/?auth_error=invalid_state");
  r = await call(callback, req("/api/auth/discord/callback?error=access_denied&state=s1", { cookie: "discord_oauth_state=s1" }), env);
  assert.equal(loc(r), "/?auth_error=access_denied");

  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (u, init) => {
    seen.push(String(u));
    if (String(u).endsWith("/oauth2/token")) {
      assert.equal(init.body.get("redirect_uri"), ORIGIN + "/api/auth/discord/callback");
      return Response.json({ access_token: "tok" });
    }
    return Response.json({ id: "77", username: "zed", global_name: "Zed", avatar: "hashabc" });
  };
  try {
    r = await call(callback, req("/api/auth/discord/callback?code=abc&state=s1", { cookie: "discord_oauth_state=s1" }), env);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(loc(r), "/?login=success");
  const cookies = r.headers.getSetCookie();
  const sess = cookies.find((c) => c.startsWith("discord_session="));
  assert.ok(/HttpOnly/.test(sess) && /SameSite=Lax/.test(sess));
  const user = await verifySession(sess.split(";")[0].split("=")[1], SECRET);
  assert.deepEqual(user, { userId: "77", username: "Zed", avatar: "hashabc" });
  assert.equal(env.DB.users.get("77").avatar, "hashabc");
  assert.ok(cookies.some((c) => c.startsWith("discord_oauth_state=;")));
});

test("/api/status: GET sem dados sensíveis; POST => 405", async () => {
  const env = mkEnv();
  const g = await call(status, req("/api/status"), env);
  const j = await g.json();
  assert.equal(g.status, 200);
  assert.ok(!("sessionUser" in j) && !("ultimosRegistros" in j));
  assert.equal((await call(status, req("/api/status", { method: "POST", body: { userId: "x" } }), env)).status, 405);
});

test("catch-all /api/*: 404 JSON not_found", async () => {
  const r = await call(apiCatchAll, req("/api/nao-existe"), mkEnv());
  assert.equal(r.status, 404);
  assert.match(r.headers.get("Content-Type"), /application\/json/);
  assert.deepEqual(await r.json(), { ok: false, error: "not_found" });
  assert.equal((await call(apiCatchAll, req("/api/x", { method: "POST", body: {} }), mkEnv())).status, 404);
});

test("PUT sem visibility mantém a visibilidade atual; com visibility valida", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const { quote } = await (await call(create, req("/api/quotes", { method: "POST", cookie: a, body: good }), env)).json();
  const id = String(quote.id);
  const { visibility, ...noVis } = good;
  const r = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { ...noVis, text: "Editado" } }), env, { id });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).quote.visibility, "public");
  const bad = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { ...good, visibility: "x" } }), env, { id });
  assert.equal(bad.status, 400);
});

test("PUT: linha some entre SELECT e UPDATE => 404 (não 500)", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const { quote } = await (await call(create, req("/api/quotes", { method: "POST", cookie: a, body: good }), env)).json();
  const id = String(quote.id);
  const realPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    const st = realPrepare(sql);
    if (!sql.includes("WHERE q.id = ?")) return st;
    return { bind: () => ({ first: async () => null }) };
  };
  const r = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: good }), env, { id });
  assert.equal(r.status, 404);
  assert.equal((await r.json()).ok, false);
});
