import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { hashToken, randomToken } from "../lib/auth.js";
import { onRequest as middleware } from "../functions/api/_middleware.js";
import { onRequestGet as start } from "../functions/api/auth/discord.js";
import { onRequestGet as callback } from "../functions/api/auth/discord/callback.js";
import { onRequestGet as me } from "../functions/api/auth/me.js";
import { onRequestPost as logout } from "../functions/api/auth/logout.js";
import { onRequest as status } from "../functions/api/status.js";

// Adaptador D1 mínimo com SQL e transações reais, inteiramente em memória.
function database(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0001_init.sql", "0002_bookmark_manager.sql"]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  function prepare(sql, values = []) {
    return {
      bind(...params) { return prepare(sql, params); },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() {
        return { success: true, results: sqlite.prepare(sql).all(...values) };
      },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  }
  return {
    sqlite,
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const origin = "https://bookmark.example";
const profile = { id: "123456789012345678", username: "estudante", global_name: "Estudante Á", avatar: null };
const brokenDB = { prepare() { throw new Error("D1 indisponível"); } };

function env(DB) {
  return { DB, DISCORD_CLIENT_ID: "client-id", DISCORD_CLIENT_SECRET: "test-secret" };
}

async function dispatch(handler, request, bindings) {
  const context = { request, env: bindings, data: {} };
  context.next = () => handler(context);
  return middleware(context);
}

function request(path, { token, method = "GET", body, headers = {} } = {}) {
  const allHeaders = { ...headers };
  if (token) allHeaders.Cookie = `discord_session=${token}`;
  if (body !== undefined) allHeaders["Content-Type"] = "application/json";
  return new Request(`${origin}${path}`, {
    method, headers: allHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function mockDiscord(t, user = profile) {
  return t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "https://discord.com/api/oauth2/token") {
      return Response.json({ access_token: "discord-test-token" });
    }
    assert.equal(url, "https://discord.com/api/users/@me");
    return Response.json(user);
  });
}

async function begin(bindings) {
  const response = await dispatch(start, request("/api/auth/discord"), bindings);
  assert.equal(response.status, 302);
  return {
    response,
    state: new URL(response.headers.get("Location")).searchParams.get("state"),
    cookie: response.headers.getSetCookie()[0].split(";")[0],
  };
}

async function finish(bindings, started, sessionToken) {
  return dispatch(callback, request(
    `/api/auth/discord/callback?code=test-code&state=${started.state}`,
    { headers: { Cookie: `${started.cookie}${sessionToken ? `; discord_session=${sessionToken}` : ""}` } },
  ), bindings);
}

async function seed(DB, { expired = false } = {}) {
  DB.sqlite.prepare("INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)")
    .run(profile.id, profile.global_name, "https://cdn.discordapp.com/embed/avatars/0.png");
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  DB.sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(await hashToken(token), profile.id, now - 86400, expired ? now - 1 : now + 86400);
  return token;
}

test("OAuth completo: state, hash persistido, identidade do POST e revogação no logout", async (t) => {
  const DB = database(t);
  const bindings = env(DB);
  const discord = mockDiscord(t);
  const started = await begin(bindings);
  assert.match(started.state, /^[a-f0-9]{64}$/);
  assert.match(started.cookie, new RegExp(`=${started.state}$`));
  assert.match(started.response.headers.get("Set-Cookie"), /HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
  const authorize = new URL(started.response.headers.get("Location"));
  assert.equal(authorize.searchParams.get("redirect_uri"), `${origin}/api/auth/discord/callback`);

  const result = await finish(bindings, started);
  assert.equal(result.status, 302);
  assert.equal(result.headers.get("Location"), "/?login=success");
  const cookies = result.headers.getSetCookie();
  assert.ok(cookies.some((entry) => entry.startsWith("discord_oauth_state=;") && entry.includes("Max-Age=0")));
  const sessionCookie = cookies.find((entry) => entry.startsWith("discord_session="));
  assert.match(sessionCookie, /HttpOnly; SameSite=Lax; Max-Age=86400; Secure/);
  const token = sessionCookie.split(";")[0].split("=")[1];
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, started.state);
  const session = DB.sqlite.prepare("SELECT * FROM auth_sessions").get();
  assert.equal(session.token_hash, await hashToken(token));
  assert.notEqual(session.token_hash, token);
  assert.equal(session.expires_at - session.created_at, 86400);
  assert.equal(discord.mock.callCount(), 2);
  assert.equal(discord.mock.calls[0].arguments[1].body.get("redirect_uri"), `${origin}/api/auth/discord/callback`);

  const identity = await dispatch(me, request("/api/auth/me", { token }), bindings);
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await identity.json(), { data: {
    user_id: profile.id, username: profile.global_name,
    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
  } });

  const saved = await dispatch(status, request("/api/status", {
    token, method: "POST", body: { conteudo: "Teste autenticado" },
  }), bindings);
  assert.equal(saved.status, 201);
  const record = DB.sqlite.prepare("SELECT user_id, username, conteudo FROM project_records").get();
  assert.equal(record.user_id, profile.id);
  assert.equal(record.username, profile.global_name);
  assert.equal(record.conteudo, "Teste autenticado");

  const exited = await dispatch(logout, request("/api/auth/logout", { token, method: "POST" }), bindings);
  assert.equal(exited.status, 204);
  assert.match(exited.headers.get("Set-Cookie"), /discord_session=;.*Max-Age=0/);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 0);
  assert.equal((await dispatch(me, request("/api/auth/me", { token }), bindings)).status, 401);
});

test("cookies ausentes, antigos, inventados, duplicados ou com nome parecido não autenticam", async (t) => {
  const DB = database(t);
  const token = await seed(DB);
  const oldCookie = btoa(encodeURIComponent(JSON.stringify({ userId: profile.id, username: "Falso" })));
  for (const header of [
    "", `discord_session=${oldCookie}`, `discord_session=${randomToken()}`,
    `discord_session=${token}; discord_session=${token}`, `xdiscord_session=${token}`,
  ]) {
    const response = await dispatch(me, request("/api/auth/me", { headers: { Cookie: header } }), env(DB));
    assert.equal(response.status, 401);
  }
});

test("sessão expirada é recusada pelo servidor, mesmo com cookie presente", async (t) => {
  const DB = database(t);
  const token = await seed(DB, { expired: true });
  assert.equal((await dispatch(me, request("/api/auth/me", { token }), env(DB))).status, 401);
  assert.equal((await dispatch(logout, request("/api/auth/logout", { token, method: "POST" }), env(DB))).status, 204);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 0);
});

test("middleware não bloqueia diagnóstico público, inclusive com D1 indisponível", async () => {
  for (const bindings of [{}, env(brokenDB)]) {
    const response = await dispatch(status, request("/api/status", { token: randomToken() }), bindings);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.d1Connected, false);
    assert.equal(body.sessionUser, null);
  }
});

test("D1 indisponível não é confundido com uma sessão autenticada", async () => {
  const token = randomToken();
  for (const bindings of [{}, env(brokenDB)]) {
    assert.equal((await dispatch(me, request("/api/auth/me", { token }), bindings)).status, 503);
    assert.equal((await dispatch(status, request("/api/status", {
      token, method: "POST", body: { conteudo: "Não salvar" },
    }), bindings)).status, 503);
  }
});

test("POST status anônimo é rejeitado sem inserir registros", async (t) => {
  const DB = database(t);
  const response = await dispatch(status, request("/api/status", {
    method: "POST", body: { userId: profile.id, username: "Falso", conteudo: "Não salvar" },
  }), env(DB));
  assert.equal(response.status, 401);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM project_records").get().n, 0);
});

test("POST status autenticado rejeita identidade forjada sem inserir registros", async (t) => {
  const DB = database(t);
  const token = await seed(DB);
  for (const identity of [{ userId: "intruso" }, { username: "Falso" }]) {
    const response = await dispatch(status, request("/api/status", {
      token, method: "POST", body: { conteudo: "Não salvar", ...identity },
    }), env(DB));
    assert.equal(response.status, 400);
    assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM project_records").get().n, 0);
  }
});

test("POST status e logout rejeitam Origin externo sem gravar ou revogar", async (t) => {
  const DB = database(t);
  const token = await seed(DB);
  for (const [handler, path] of [[status, "/api/status"], [logout, "/api/auth/logout"]]) {
    const response = await dispatch(handler, request(path, {
      token, method: "POST", body: { conteudo: "Não salvar" }, headers: { Origin: "https://externo.example" },
    }), env(DB));
    assert.equal(response.status, 403);
  }
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 1);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM project_records").get().n, 0);
});

test("state ausente, diferente, malformado ou sem cookie falha antes do fetch", async (t) => {
  const DB = database(t);
  const discord = mockDiscord(t);
  const state = randomToken();
  for (const [query, cookie] of [
    ["", state], [randomToken(), state], ["inválido", state], [state, null],
  ]) {
    const response = await dispatch(callback, request(
      `/api/auth/discord/callback?code=code&state=${encodeURIComponent(query)}`,
      { headers: cookie ? { Cookie: `discord_oauth_state=${cookie}` } : {} },
    ), env(DB));
    assert.equal(response.status, 400);
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  }
  assert.equal(discord.mock.callCount(), 0);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 0);
});

test("cancelamento OAuth e código ausente limpam state sem criar sessão", async (t) => {
  const DB = database(t);
  const discord = mockDiscord(t);
  const state = randomToken();
  for (const query of ["error=access_denied", ""]) {
    const response = await dispatch(callback, request(`/api/auth/discord/callback?${query}&state=${state}`, {
      headers: { Cookie: `discord_oauth_state=${state}` },
    }), env(DB));
    assert.equal(response.status, 302);
    assert.match(response.headers.get("Location"), /auth_error=/);
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  }
  assert.equal(discord.mock.callCount(), 0);
});

test("login exige credenciais existentes e binding D1", async () => {
  for (const bindings of [{}, { DISCORD_CLIENT_ID: "id" }, env(undefined)]) {
    assert.equal((await dispatch(start, request("/api/auth/discord"), bindings)).status, 503);
  }
});

test("falha ao inserir sessão desfaz o perfil e não emite cookie de sessão", async (t) => {
  const DB = database(t);
  mockDiscord(t);
  DB.sqlite.exec(`CREATE TRIGGER reject_session BEFORE INSERT ON auth_sessions
    BEGIN SELECT RAISE(ABORT, 'Falha de escrita simulada'); END`);
  const bindings = env(DB);
  const response = await finish(bindings, await begin(bindings));
  assert.equal(response.status, 503);
  assert.ok(response.headers.getSetCookie().every((entry) => !entry.startsWith("discord_session=")));
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM discord_users").get().n, 0);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 0);
});

test("novo login substitui a sessão anterior e atualiza o perfil", async (t) => {
  const DB = database(t);
  const oldToken = await seed(DB);
  mockDiscord(t, { ...profile, global_name: "Nome atualizado" });
  const bindings = env(DB);
  const response = await finish(bindings, await begin(bindings), oldToken);
  assert.equal(response.status, 302);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 1);
  assert.equal(DB.sqlite.prepare("SELECT username FROM discord_users").get().username, "Nome atualizado");
  assert.equal((await dispatch(me, request("/api/auth/me", { token: oldToken }), bindings)).status, 401);
});

test("perfil inválido e falhas do Discord não emitem sessões", async (t) => {
  const DB = database(t);
  let tokenFailure = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/token")) {
      return tokenFailure ? new Response(null, { status: 400 }) : Response.json({ access_token: "test" });
    }
    return Response.json({ ...profile, id: "identidade-inválida" });
  });
  const bindings = env(DB);
  for (const expected of ["invalid_profile", "token_exchange_failed"]) {
    const response = await finish(bindings, await begin(bindings));
    assert.equal(response.status, 302);
    assert.match(response.headers.get("Location"), new RegExp(expected));
    assert.ok(response.headers.getSetCookie().every((entry) => !entry.startsWith("discord_session=")));
    tokenFailure = true;
  }
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 0);
});

test("logout é idempotente; falha D1 retorna erro e expira cookie", async () => {
  assert.equal((await dispatch(logout, request("/api/auth/logout", { method: "POST" }), {})).status, 204);
  const response = await dispatch(logout, request("/api/auth/logout", {
    token: randomToken(), method: "POST",
  }), env(brokenDB));
  assert.equal(response.status, 503);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("0002: propriedade composta, status, publicação e exclusão de coleção não vazia", (t) => {
  const { sqlite } = database(t);
  sqlite.exec(`INSERT INTO discord_users (user_id, username) VALUES ('a', 'A'), ('b', 'B');
    INSERT INTO collections (id, user_id, name) VALUES ('c', 'a', 'Estudos');`);
  const insert = sqlite.prepare(`INSERT INTO bookmarks (id, user_id, collection_id, url, title, status)
    VALUES (?, ?, 'c', 'https://example.com', 'Artigo', ?)`);
  assert.throws(() => insert.run("estrangeiro", "b", "para_ler"), /FOREIGN KEY/);
  assert.throws(() => insert.run("inválido", "a", "pendente"), /CHECK/);
  assert.throws(() => sqlite.exec("UPDATE collections SET is_public = 2 WHERE id = 'c'"), /CHECK/);
  insert.run("válido", "a", "para_ler");
  assert.throws(() => sqlite.exec("DELETE FROM collections WHERE id = 'c'"), /FOREIGN KEY/);
  sqlite.exec("DELETE FROM bookmarks; DELETE FROM collections WHERE id = 'c'");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM collections").get().n, 0);
});
