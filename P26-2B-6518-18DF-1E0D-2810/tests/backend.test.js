import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { onRequestGet as oauthStart } from "../functions/api/auth/discord.js";
import { onRequestGet as oauthCallback } from "../functions/api/auth/discord/callback.js";
import { onRequestGet as authMe } from "../functions/api/auth/me.js";
import { onRequestPost as authLogout } from "../functions/api/auth/logout.js";
import { onRequestGet as listSubjects, onRequestPost as createSubject } from "../functions/api/subjects.js";
import { onRequestPatch as updateSubject, onRequestDelete as archiveSubject } from "../functions/api/subjects/[id].js";
import { onRequestPost as startCycle } from "../functions/api/pomodoro/cycles.js";
import { onRequestGet as activeCycle } from "../functions/api/pomodoro/active.js";
import { onRequestPost as completeCycle } from "../functions/api/pomodoro/cycles/[id]/complete.js";
import { onRequestPost as cancelCycle } from "../functions/api/pomodoro/cycles/[id]/cancel.js";
import { onRequestGet as weeklyMetrics } from "../functions/api/metrics/weekly.js";
import { requireDatabase, sha256 } from "../functions/_shared.js";
import { weeklyRange } from "../functions/_weekly.js";

const projectRoot = new URL("..", import.meta.url).pathname;

class LocalD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new LocalD1Statement(this.database, this.sql, values);
  }

  async first(column) {
    const row = this.database.prepare(this.sql).get(...this.values) || null;
    return column ? row?.[column] ?? null : row;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

class LocalD1 {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new LocalD1Statement(this.database, sql);
  }
}

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(join(projectRoot, "migrations/0001_init.sql"), "utf8"));
  sqlite.exec(readFileSync(join(projectRoot, "migrations/0002_pomodoro_backend.sql"), "utf8"));
  const env = { DB: new LocalD1(sqlite), DISCORD_CLIENT_ID: "client-id", DISCORD_CLIENT_SECRET: "client-secret" };

  function addUser(userId, token = sha256Sync(userId)) {
    const now = new Date().toISOString();
    sqlite.prepare(
      "INSERT INTO discord_users (user_id, username, global_name, avatar, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, `user-${userId}`, `Global ${userId}`, null, now);
    sqlite.prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).run(sha256Sync(token), userId, now, new Date(Date.now() + 60 * 60 * 1000).toISOString());
    return token;
  }

  function addSubject(userId, name = "Matemática") {
    const now = new Date().toISOString();
    const result = sqlite.prepare(
      "INSERT INTO subjects (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).run(userId, name, now, now);
    return Number(result.lastInsertRowid);
  }

  return { sqlite, env, addUser, addSubject };
}

function sha256Sync(value) {
  return createHash("sha256").update(value).digest("hex");
}

function context(env, path, { method = "GET", token, body, headers = {}, params = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("Cookie", `discord_session=${token}`);
  if (method !== "GET" && !requestHeaders.has("Origin")) requestHeaders.set("Origin", "https://pomodoro.test");
  const request = new Request(`https://pomodoro.test${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { request, env, params };
}

async function postJson(handler, env, path, token, body, options = {}) {
  return handler(context(env, path, { method: "POST", token, body, headers: options.headers || {}, params: options.params || {} }));
}

async function createOwnedSubject(env, token, name = "Cálculo") {
  const response = await postJson(createSubject, env, "/api/subjects", token, { name });
  assert.equal(response.status, 201);
  return (await response.json()).subject;
}

async function beginOAuthCallback(env) {
  const start = await oauthStart(context(env, "/api/auth/discord"));
  const authorizeUrl = new URL(start.headers.get("Location"));
  const state = authorizeUrl.searchParams.get("state");
  const stateCookie = start.headers.get("Set-Cookie").split(";")[0];
  return context(env, `/api/auth/discord/callback?code=auth-code&state=${state}`, {
    headers: { Cookie: stateCookie },
  });
}

function failD1Run(env, matches) {
  const originalPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (!matches(sql)) return originalPrepare(sql);
    return {
      bind() {
        return {
          async first() { throw new Error("simulated D1 operational failure"); },
          async all() { throw new Error("simulated D1 operational failure"); },
          async run() { throw new Error("simulated D1 operational failure"); },
        };
      },
    };
  };
}

function mockDiscordProfile(t) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => url.endsWith("/token")
    ? new Response(JSON.stringify({ access_token: "oauth-access" }), { status: 200 })
    : new Response(JSON.stringify({ id: "discord-123", username: "vytor", global_name: "João Vytor", avatar: "hash" }), { status: 200 });
  t.after(() => { globalThis.fetch = originalFetch; });
}

test("Discord OAuth usa state de uso único, importa perfil e cria sessão validável", async (t) => {
  const { sqlite, env } = setup();
  t.after(() => sqlite.close());

  const start = await oauthStart(context(env, "/api/auth/discord"));
  assert.equal(start.status, 302);
  const authorizeUrl = new URL(start.headers.get("Location"));
  const state = authorizeUrl.searchParams.get("state");
  assert.equal((await env.DB.prepare("SELECT state_hash FROM oauth_states").first()).state_hash, await sha256(state));
  const stateCookie = start.headers.get("Set-Cookie").split(";")[0];
  assert.match(start.headers.get("Set-Cookie"), /HttpOnly; Secure; SameSite=Lax/);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => url.endsWith("/token")
    ? new Response(JSON.stringify({ access_token: "oauth-access" }), { status: 200 })
    : new Response(JSON.stringify({ id: "discord-123", username: "vytor", global_name: "João Vytor", avatar: "hash" }), { status: 200 });
  t.after(() => { globalThis.fetch = originalFetch; });

  const callbackContext = context(env, `/api/auth/discord/callback?code=auth-code&state=${state}`, {
    headers: { Cookie: stateCookie },
  });
  const callback = await oauthCallback(callbackContext);
  assert.equal(callback.status, 302);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS total FROM oauth_states").first("total"), 0);
  const profile = await env.DB.prepare("SELECT user_id, username, global_name FROM discord_users").first();
  assert.deepEqual({ ...profile }, { user_id: "discord-123", username: "vytor", global_name: "João Vytor" });
  const cookies = callback.headers.getSetCookie();
  const sessionToken = cookies.find((value) => value.startsWith("discord_session=")).split(";")[0].split("=")[1];
  assert.match(cookies.find((value) => value.startsWith("discord_session=")), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(await env.DB.prepare("SELECT token_hash FROM sessions").first("token_hash"), await sha256(sessionToken));

  const me = await authMe(context(env, "/api/auth/me", { headers: { Cookie: `discord_session=${sessionToken}` } }));
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.global_name, "João Vytor");

  const replay = await oauthCallback(callbackContext);
  assert.match(replay.headers.get("Location"), /invalid_oauth_state/);
  const logout = await authLogout(context(env, "/api/auth/logout", { method: "POST", headers: { Cookie: `discord_session=${sessionToken}` } }));
  assert.equal(logout.status, 200);
  assert.equal((await authMe(context(env, "/api/auth/me", { headers: { Cookie: `discord_session=${sessionToken}` } }))).status, 401);
});

test("falha ao persistir usuário OAuth retorna 500 sem criar sessão", async (t) => {
  const { sqlite, env } = setup();
  t.after(() => sqlite.close());
  mockDiscordProfile(t);
  const callbackContext = await beginOAuthCallback(env);
  failD1Run(env, (sql) => sql.includes("INSERT INTO discord_users"));

  const response = await oauthCallback(callbackContext);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Location"), null);
  assert.doesNotMatch(response.headers.get("Set-Cookie") || "", /discord_session=/);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS total FROM discord_users").first("total"), 0);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS total FROM sessions").first("total"), 0);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "database_error",
    message: "Erro operacional ao acessar o banco de dados.",
  });
});

test("falha ao persistir sessão OAuth não emite cookie autenticado", async (t) => {
  const { sqlite, env } = setup();
  t.after(() => sqlite.close());
  mockDiscordProfile(t);
  const callbackContext = await beginOAuthCallback(env);
  failD1Run(env, (sql) => sql.includes("INSERT INTO sessions"));

  const response = await oauthCallback(callbackContext);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Location"), null);
  assert.doesNotMatch(response.headers.get("Set-Cookie") || "", /discord_session=/);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS total FROM discord_users").first("total"), 1);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS total FROM sessions").first("total"), 0);
  assert.equal((await response.json()).error, "database_error");
});

test("falha externa do Discord permanece distinta de falha interna D1", async (t) => {
  const { sqlite, env } = setup();
  t.after(() => sqlite.close());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("provider unavailable", { status: 503 });
  t.after(() => { globalThis.fetch = originalFetch; });
  const callbackContext = await beginOAuthCallback(env);

  const response = await oauthCallback(callbackContext);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(response.headers.get("Location"), /auth_error=token_exchange_failed/);
  assert.doesNotMatch(response.headers.get("Set-Cookie") || "", /discord_session=/);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS total FROM sessions").first("total"), 0);
});

test("disciplinas são isoladas por usuário e DELETE apenas arquiva", async (t) => {
  const { sqlite, env, addUser } = setup();
  t.after(() => sqlite.close());
  const tokenA = addUser("user-a");
  const tokenB = addUser("user-b");
  const subjectA = await createOwnedSubject(env, tokenA, "Física");
  const subjectB = await createOwnedSubject(env, tokenB, "História");

  const listA = await listSubjects(context(env, "/api/subjects", { token: tokenA }));
  assert.deepEqual((await listA.json()).subjects.map(({ name }) => name), ["Física"]);
  const crossUserPatch = await updateSubject(context(env, `/api/subjects/${subjectB.id}`, {
    method: "PATCH", token: tokenA, body: { name: "Tentativa" }, params: { id: String(subjectB.id) },
  }));
  assert.equal(crossUserPatch.status, 404);
  const crossUserDelete = await archiveSubject(context(env, `/api/subjects/${subjectB.id}`, {
    method: "DELETE", token: tokenA, params: { id: String(subjectB.id) },
  }));
  assert.equal(crossUserDelete.status, 404);

  const update = await updateSubject(context(env, `/api/subjects/${subjectA.id}`, {
    method: "PATCH", token: tokenA, body: { name: "Física II" }, params: { id: String(subjectA.id) },
  }));
  assert.equal((await update.json()).subject.name, "Física II");
  const archived = await archiveSubject(context(env, `/api/subjects/${subjectA.id}`, {
    method: "DELETE", token: tokenA, params: { id: String(subjectA.id) },
  }));
  assert.ok((await archived.json()).subject.archived_at);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM subjects WHERE id = ?").get(subjectA.id).total, 1);
});

test("PATCH retorna 409 para nome duplicado e 500 para falha operacional D1", async (t) => {
  const { sqlite, env, addUser } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const first = await createOwnedSubject(env, token, "Física");
  const second = await createOwnedSubject(env, token, "Química");

  const duplicate = await updateSubject(context(env, `/api/subjects/${second.id}`, {
    method: "PATCH", token, body: { name: "Física" }, params: { id: String(second.id) },
  }));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), {
    ok: false,
    error: "subject_name_conflict",
    message: "Já existe uma disciplina ativa com esse nome.",
  });

  failD1Run(env, (sql) => sql.startsWith("UPDATE subjects SET name"));
  const operational = await updateSubject(context(env, `/api/subjects/${first.id}`, {
    method: "PATCH", token, body: { name: "Física II" }, params: { id: String(first.id) },
  }));
  assert.equal(operational.status, 500);
  assert.equal(operational.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await operational.json(), {
    ok: false,
    error: "database_error",
    message: "Erro operacional ao acessar o banco de dados.",
  });
});

test("início de ciclos exige idempotência e impede ciclos concorrentes por usuário", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const missingKey = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 60,
  });
  assert.equal(missingKey.status, 400);

  const concurrent = await Promise.all(["run-a", "run-b"].map((key) => postJson(
    startCycle, env, "/api/pomodoro/cycles", token,
    { subject_id: subjectId, duration_seconds: 60 }, { headers: { "Idempotency-Key": key } },
  )));
  assert.deepEqual(concurrent.map(({ status }) => status).sort(), [201, 409]);
  assert.equal((await activeCycle(context(env, "/api/pomodoro/active", { token }))).status, 200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM pomodoro_cycles WHERE user_id = ? AND status = 'running'").get("user-a").total, 1);
});

test("idempotência retorna o mesmo ciclo e rejeita outra carga", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const options = { headers: { "Idempotency-Key": "same-key" } };
  const first = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 120,
  }, options);
  const firstCycle = (await first.json()).cycle;
  assert.equal(first.status, 201);

  const replay = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 120,
  }, options);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).cycle.id, firstCycle.id);
  const conflict = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 180,
  }, options);
  assert.equal(conflict.status, 409);
});

test("conclusão de ciclo é idempotente e cancelamentos não contam", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const start = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 60,
  }, { headers: { "Idempotency-Key": "finish-test" } });
  const cycleId = (await start.json()).cycle.id;

  const early = await completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token, params: { id: String(cycleId) },
  }));
  assert.equal(early.status, 409);

  sqlite.prepare("UPDATE pomodoro_cycles SET started_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 61_000).toISOString(), cycleId);
  const completed = await completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token, params: { id: String(cycleId) },
  }));
  assert.equal(completed.status, 200);
  const firstResult = await completed.json();
  assert.equal(firstResult.replayed, false);
  const completedAt = firstResult.cycle.completed_at;

  await new Promise((resolve) => setTimeout(resolve, 5));
  const duplicate = await completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token, params: { id: String(cycleId) },
  }));
  assert.equal(duplicate.status, 200);
  const replayResult = await duplicate.json();
  assert.equal(replayResult.replayed, true);
  assert.equal(replayResult.cycle.completed_at, completedAt);
  assert.equal(sqlite.prepare("SELECT completed_at FROM pomodoro_cycles WHERE id = ?").get(cycleId).completed_at, completedAt);

  const next = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 60,
  }, { headers: { "Idempotency-Key": "cancel-test" } });
  const nextId = (await next.json()).cycle.id;
  const cancelled = await cancelCycle(context(env, `/api/pomodoro/cycles/${nextId}/cancel`, {
    method: "POST", token, params: { id: String(nextId) },
  }));
  assert.equal((await cancelled.json()).cycle.status, "cancelled");
  const completeCancelled = await completeCycle(context(env, `/api/pomodoro/cycles/${nextId}/complete`, {
    method: "POST", token, params: { id: String(nextId) },
  }));
  assert.equal(completeCancelled.status, 409);

  const metrics = await weeklyMetrics(context(env, "/api/metrics/weekly", { token }));
  const data = await metrics.json();
  assert.equal(data.total_seconds, 60);
  assert.equal(data.completed_cycles, 1);
});

test("ciclo inexistente retorna 404 sem alterar registros ou métricas", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const start = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 60,
  }, { headers: { "Idempotency-Key": "missing-completion-baseline" } });
  assert.equal(start.status, 201);
  const existingCycleId = (await start.json()).cycle.id;
  const now = Date.now();
  sqlite.prepare(
    "UPDATE pomodoro_cycles SET status = 'completed', started_at = ?, completed_at = ? WHERE id = ?"
  ).run(new Date(now - 70_000).toISOString(), new Date(now - 10_000).toISOString(), existingCycleId);

  const readCycles = () => sqlite.prepare(
    "SELECT id, subject_id, duration_seconds, status, started_at, completed_at, cancelled_at FROM pomodoro_cycles ORDER BY id"
  ).all().map((row) => ({ ...row }));
  const beforeCycles = readCycles();
  const beforeMetricsResponse = await weeklyMetrics(context(env, "/api/metrics/weekly", { token }));
  assert.equal(beforeMetricsResponse.status, 200);
  const beforeMetrics = await beforeMetricsResponse.json();
  assert.equal(beforeMetrics.completed_cycles, 1);

  const missingCycleId = 987654321;
  const response = await completeCycle(context(env, `/api/pomodoro/cycles/${missingCycleId}/complete`, {
    method: "POST", token, params: { id: String(missingCycleId) },
  }));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "cycle_not_found");

  const afterMetricsResponse = await weeklyMetrics(context(env, "/api/metrics/weekly", { token }));
  assert.equal(afterMetricsResponse.status, 200);
  assert.deepEqual(await afterMetricsResponse.json(), beforeMetrics);
  assert.deepEqual(readCycles(), beforeCycles);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM pomodoro_cycles WHERE id = ?").get(missingCycleId).total,
    0,
  );
});

test("conclusões simultâneas recuperam a mesma gravação sem contabilizar duas vezes", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const start = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 60,
  }, { headers: { "Idempotency-Key": "concurrent-completion" } });
  const cycleId = (await start.json()).cycle.id;
  sqlite.prepare("UPDATE pomodoro_cycles SET started_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 61_000).toISOString(), cycleId);

  const originalPrepare = env.DB.prepare.bind(env.DB);
  const cycleSelect = "SELECT id, subject_id, duration_seconds, status, started_at, completed_at FROM pomodoro_cycles WHERE id = ? AND user_id = ?";
  let initialReads = 0;
  let releaseReads;
  const bothReadsComplete = new Promise((resolve) => { releaseReads = resolve; });
  env.DB.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (sql !== cycleSelect) return statement;
    return {
      bind(...values) {
        const bound = statement.bind(...values);
        return {
          async first(...args) {
            if (initialReads < 2) {
              initialReads += 1;
              if (initialReads === 2) releaseReads();
              await bothReadsComplete;
            }
            return bound.first(...args);
          },
        };
      },
    };
  };

  const requests = [1, 2].map(() => completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token, params: { id: String(cycleId) },
  })));
  const responses = await Promise.all(requests);
  const results = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true]);
  assert.equal(results[0].cycle.completed_at, results[1].cycle.completed_at);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM pomodoro_cycles WHERE id = ? AND status = 'completed'").get(cycleId).total, 1);

  const metrics = await weeklyMetrics(context(env, "/api/metrics/weekly", { token }));
  const data = await metrics.json();
  assert.equal(data.completed_cycles, 1);
  assert.equal(data.total_seconds, 60);
});

test("um usuário diferente não consegue concluir nem ler o ciclo", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const ownerToken = addUser("user-a");
  const otherToken = addUser("user-b");
  const subjectId = addSubject("user-a");
  const start = await postJson(startCycle, env, "/api/pomodoro/cycles", ownerToken, {
    subject_id: subjectId, duration_seconds: 60,
  }, { headers: { "Idempotency-Key": "ownership-completion" } });
  const cycleId = (await start.json()).cycle.id;
  sqlite.prepare("UPDATE pomodoro_cycles SET started_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 61_000).toISOString(), cycleId);

  const response = await completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token: otherToken, params: { id: String(cycleId) },
  }));
  assert.equal(response.status, 404);
  assert.equal(sqlite.prepare("SELECT status FROM pomodoro_cycles WHERE id = ?").get(cycleId).status, "running");
});

test("requisição repetida recupera a conclusão após perda da primeira resposta", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const start = await postJson(startCycle, env, "/api/pomodoro/cycles", token, {
    subject_id: subjectId, duration_seconds: 60,
  }, { headers: { "Idempotency-Key": "lost-completion-response" } });
  const cycleId = (await start.json()).cycle.id;
  sqlite.prepare("UPDATE pomodoro_cycles SET started_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 61_000).toISOString(), cycleId);

  await completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token, params: { id: String(cycleId) },
  }));
  const retry = await completeCycle(context(env, `/api/pomodoro/cycles/${cycleId}/complete`, {
    method: "POST", token, params: { id: String(cycleId) },
  }));
  const data = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(data.replayed, true);
  assert.equal(data.cycle.status, "completed");
  assert.ok(data.cycle.completed_at);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM pomodoro_cycles WHERE id = ?").get(cycleId).total, 1);
});

test("métricas respeitam a semana de São Paulo e a virada de segunda-feira", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");
  const subjectA = addSubject("user-a", "Matemática");
  const subjectB = addSubject("user-a", "Biologia");
  const range = weeklyRange();
  const before = new Date(Date.parse(range.start) - 1).toISOString();
  const atEnd = range.end;
  const addCompleted = (key, subject, seconds, completedAt) => {
    sqlite.prepare(
      `INSERT INTO pomodoro_cycles
       (user_id, subject_id, idempotency_key, duration_seconds, status, started_at, completed_at)
       VALUES ('user-a', ?, ?, ?, 'completed', ?, ?)`
    ).run(subject, key, seconds, new Date(Date.parse(completedAt) - seconds * 1000).toISOString(), completedAt);
  };
  addCompleted("week-a", subjectA, 3600, range.start);
  addCompleted("week-b", subjectB, 1800, new Date(Date.parse(range.start) + 1).toISOString());
  addCompleted("previous-week", subjectA, 7200, before);
  addCompleted("next-week", subjectB, 7200, atEnd);

  const response = await weeklyMetrics(context(env, "/api/metrics/weekly", { token }));
  const data = await response.json();
  assert.equal(data.week.time_zone, "America/Sao_Paulo");
  assert.equal(data.total_seconds, 5400);
  assert.equal(data.total_hours, 1.5);
  assert.equal(data.completed_cycles, 2);
  assert.equal(data.subjects.length, 2);

  const beforeMonday = weeklyRange(new Date("2026-11-23T02:59:59.000Z"));
  const afterMonday = weeklyRange(new Date("2026-11-23T03:00:00.000Z"));
  assert.equal(beforeMonday.startsOn, "2026-11-16");
  assert.equal(afterMonday.startsOn, "2026-11-23");
});

test("rotas protegidas rejeitam falta de sessão e origem cruzada", async (t) => {
  const { sqlite, env, addUser, addSubject } = setup();
  t.after(() => sqlite.close());
  const unauthorized = await listSubjects(context(env, "/api/subjects"));
  assert.equal(unauthorized.status, 401);

  const token = addUser("user-a");
  const subjectId = addSubject("user-a");
  const request = context(env, "/api/pomodoro/cycles", {
    method: "POST", token, body: { subject_id: subjectId, duration_seconds: 60 },
    headers: { Origin: "https://attacker.test", "Idempotency-Key": "csrf-test" },
  });
  assert.equal((await startCycle(request)).status, 403);
});

test("unicidade real retorna 409 e falha operacional D1 retorna 500", async (t) => {
  const { sqlite, env, addUser } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");

  const first = await postJson(createSubject, env, "/api/subjects", token, { name: "Física" });
  assert.equal(first.status, 201);
  const duplicate = await postJson(createSubject, env, "/api/subjects", token, { name: "física" });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, "subject_name_conflict");

  failD1Run(env, (sql) => sql.includes("FROM subjects"));
  const operational = await listSubjects(context(env, "/api/subjects", { token }));
  assert.equal(operational.status, 500);
  assert.equal(operational.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await operational.json(), {
    ok: false,
    error: "database_error",
    message: "Erro operacional ao acessar o banco de dados.",
  });
});

test("D1 ausente retorna 503 database_unavailable sem cache", async () => {
  const response = requireDatabase({});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "database_unavailable",
    message: "Banco de dados indisponível.",
  });
});

test("respostas protegidas e erros autenticados usam Cache-Control no-store", async (t) => {
  const { sqlite, env, addUser } = setup();
  t.after(() => sqlite.close());
  const token = addUser("user-a");

  const responses = [
    await authMe(context(env, "/api/auth/me", { token })),
    await listSubjects(context(env, "/api/subjects", { token })),
    await activeCycle(context(env, "/api/pomodoro/active", { token })),
    await weeklyMetrics(context(env, "/api/metrics/weekly", { token })),
  ];
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }

  const missing = await archiveSubject(context(env, "/api/subjects/999", {
    method: "DELETE", token, params: { id: "999" },
  }));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cache-Control"), "no-store");

  const unauthorized = await listSubjects(context(env, "/api/subjects"));
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("Cache-Control"), "no-store");
});