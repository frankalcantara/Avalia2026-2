// Eventos: criação com validação no servidor, listagem, detalhe e exclusão.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  allRoutesExist,
  call,
  insertEvent,
  load,
  login,
  makeEnv,
  spDate,
} from "./helpers/app.mjs";

const ready = allRoutesExist("events", "event");
const opts = ready ? {} : { skip: "functions/api/events/index.js ou [id].js ainda não existe" };

function validBody(over = {}) {
  return {
    title: "Grupo de estudo de SQL",
    description: "Revisão de JOINs",
    location: "Bloco B, sala 204",
    date: spDate(7),
    time: "19:00",
    capacity: 30,
    ...over,
  };
}

async function createEvent(env, cookie, body, extra = {}) {
  const mod = await load("events");
  return call(mod, "POST", { env, path: "/api/events", cookie, body, ...extra });
}

async function list(env, cookie, query = "") {
  const mod = await load("events");
  return call(mod, "GET", { env, path: `/api/events${query}`, cookie });
}

async function del(env, id, cookie, extra = {}) {
  const mod = await load("event");
  return call(mod, "DELETE", {
    env,
    path: `/api/events/${id}`,
    params: { id: String(id) },
    cookie,
    ...extra,
  });
}

describe("POST /api/events: criação", opts, () => {
  test("cria evento válido → 201 com EventSummary e criador da sessão", async () => {
    const env = await makeEnv();
    const { user, cookie } = await login(env, { username: "ana" });
    const r = await createEvent(env, cookie, validBody());
    assert.equal(r.status, 201, r.text);
    const ev = r.json.event;
    assert.ok(Number.isInteger(ev.id));
    assert.equal(ev.title, "Grupo de estudo de SQL");
    assert.equal(ev.location, "Bloco B, sala 204");
    assert.equal(ev.date, spDate(7));
    assert.equal(ev.time, "19:00");
    assert.equal(ev.capacity, 30);
    assert.equal(ev.confirmed_count, 0);
    assert.equal(ev.waitlist_count, 0);
    assert.equal(ev.spots_left, 30);
    assert.equal(ev.creator.user_id, user.user_id);
    assert.equal(ev.creator.username, "ana");
    assert.match(ev.creator.avatar_url, /^https:\/\/cdn\.discordapp\.com\//);
    assert.equal(ev.is_creator, true);
    assert.equal(ev.my_status, null);
    assert.equal(ev.my_position, null);
    assert.equal(r.headers.get("Cache-Control"), "no-store");
    assert.match(r.headers.get("Content-Type") ?? "", /application\/json/);
  });

  test("creator_id enviado pelo cliente é ignorado", async () => {
    const env = await makeEnv();
    const other = await login(env);
    const { user, cookie } = await login(env);
    const r = await createEvent(env, cookie, validBody({ creator_id: other.user.user_id }));
    assert.equal(r.status, 201, r.text);
    const row = env.DB.query("SELECT creator_id FROM events WHERE id = ?", [r.json.event.id])[0];
    assert.equal(row.creator_id, user.user_id);
  });

  test("entrada maliciosa é guardada como texto (SQL parametrizado)", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    const evil = "x'); DROP TABLE events; --";
    const r = await createEvent(env, cookie, validBody({ title: evil, location: "<img src=x onerror=alert(1)>" }));
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.event.title, evil);
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM events")[0].n, 1);
  });

  test("hoje é aceito (não é data passada no fuso de São Paulo)", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    const r = await createEvent(env, cookie, validBody({ date: spDate(0), time: "23:59" }));
    assert.equal(r.status, 201, r.text);
  });

  const invalid = [
    ["título curto", { title: "ab" }, "title"],
    ["título longo", { title: "x".repeat(121) }, "title"],
    ["título não string", { title: 12345 }, "title"],
    ["local curto", { location: "a" }, "location"],
    ["local longo", { location: "x".repeat(121) }, "location"],
    ["descrição longa", { description: "x".repeat(2001) }, "description"],
    ["capacidade 0", { capacity: 0 }, "capacity"],
    ["capacidade negativa", { capacity: -3 }, "capacity"],
    ["capacidade não inteira", { capacity: 2.5 }, "capacity"],
    ["capacidade acima de 10000", { capacity: 10001 }, "capacity"],
    ["capacidade texto", { capacity: "dez" }, "capacity"],
    ["capacidade ausente", { capacity: undefined }, "capacity"],
    ["data passada", { date: spDate(-1) }, "date"],
    ["data inexistente", { date: "2027-02-30" }, "date"],
    ["data em formato errado", { date: "27/11/2027" }, "date"],
    ["data ausente", { date: undefined }, "date"],
    ["hora inválida", { time: "25:00" }, "time"],
    ["hora em formato errado", { time: "7pm" }, "time"],
  ];
  for (const [name, over, field] of invalid) {
    test(`validação: ${name} → 400 validation (fields.${field})`, async () => {
      const env = await makeEnv();
      const { cookie } = await login(env);
      const r = await createEvent(env, cookie, validBody(over));
      assert.equal(r.status, 400, r.text);
      assert.equal(r.json.error, "validation");
      assert.equal(typeof r.json.message, "string");
      assert.ok(r.json.fields && field in r.json.fields, `fields deveria citar ${field}: ${r.text}`);
      assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM events")[0].n, 0);
    });
  }

  test("JSON inválido ou corpo que não é objeto → 400", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    for (const body of ["{não é json", "[1,2,3]", "null"]) {
      const r = await createEvent(env, cookie, body);
      assert.equal(r.status, 400, `${body}: ${r.text}`);
      assert.ok(r.json?.error, r.text);
    }
  });

  test("sem sessão → 401 unauthenticated", async () => {
    const env = await makeEnv();
    const r = await createEvent(env, undefined, validBody());
    assert.equal(r.status, 401, r.text);
    assert.equal(r.json.error, "unauthenticated");
    assert.equal(typeof r.json.message, "string");
  });

  test("Origin diferente ou ausente → 403 invalid_origin", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    for (const origin of ["https://evil.example", "http://teste.pages.dev", null]) {
      const r = await createEvent(env, cookie, validBody(), { origin });
      assert.equal(r.status, 403, `${origin}: ${r.text}`);
      assert.equal(r.json.error, "invalid_origin");
    }
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM events")[0].n, 0);
  });
});

describe("GET /api/events e /api/events/:id", opts, () => {
  test("lista só de hoje em diante, ordenada por data e hora; scope=all traz passados", async () => {
    const env = await makeEnv();
    const { user } = await login(env);
    const past = insertEvent(env, user.user_id, { title: "Passado", date: spDate(-3) });
    const late = insertEvent(env, user.user_id, { title: "Depois", date: spDate(5), time: "20:00" });
    const early = insertEvent(env, user.user_id, { title: "Antes", date: spDate(5), time: "08:00" });
    const today = insertEvent(env, user.user_id, { title: "Hoje", date: spDate(0), time: "23:00" });

    const r = await list(env);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json.events.map((e) => e.id), [today, early, late]);
    for (const e of r.json.events) {
      assert.equal(e.my_status, null);
      assert.equal(e.my_position, null);
      assert.equal(e.is_creator, false);
    }
    const all = await list(env, undefined, "?scope=all");
    assert.equal(all.status, 200, all.text);
    assert.ok(all.json.events.some((e) => e.id === past), "scope=all inclui passados");
  });

  test("scope=mine exige sessão e traz criados e inscritos", async () => {
    const env = await makeEnv();
    const a = await login(env);
    const b = await login(env);
    const mine = insertEvent(env, a.user.user_id, { title: "Meu" });
    const other = insertEvent(env, b.user.user_id, { title: "Do B" });
    const third = insertEvent(env, b.user.user_id, { title: "Inscrito" });
    env.DB.query(
      "INSERT INTO registrations (event_id, user_id, status, requested_at) VALUES (?, ?, 'confirmed', ?)",
      [third, a.user.user_id, Date.now()],
    );
    const anon = await list(env, undefined, "?scope=mine");
    assert.equal(anon.status, 401, anon.text);
    const r = await list(env, a.cookie, "?scope=mine");
    assert.equal(r.status, 200, r.text);
    const ids = r.json.events.map((e) => e.id).sort();
    assert.deepEqual(ids, [mine, third].sort());
    assert.ok(!ids.includes(other));
    const ins = r.json.events.find((e) => e.id === third);
    assert.equal(ins.my_status, "confirmed");
    assert.equal(r.json.events.find((e) => e.id === mine).is_creator, true);
  });

  test("detalhe de evento inexistente → 404 not_found", async () => {
    const env = await makeEnv();
    const mod = await load("event");
    const r = await call(mod, "GET", { env, path: "/api/events/4242", params: { id: "4242" } });
    assert.equal(r.status, 404, r.text);
    assert.equal(r.json.error, "not_found");
  });

  test("detalhe sem sessão funciona e não identifica ninguém", async () => {
    const env = await makeEnv();
    const { user } = await login(env);
    const id = insertEvent(env, user.user_id, { capacity: 4 });
    const mod = await load("event");
    const r = await call(mod, "GET", { env, path: `/api/events/${id}`, params: { id: String(id) } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.event.is_creator, false);
    assert.deepEqual(r.json.confirmed, []);
    assert.deepEqual(r.json.waitlist, []);
    assert.equal(r.headers.get("Cache-Control"), "no-store");
  });
});

describe("DELETE /api/events/:id", opts, () => {
  test("só o criador apaga: outro usuário → 403 forbidden; criador → 204", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const intruso = await login(env);
    const id = insertEvent(env, owner.user.user_id);
    env.DB.query(
      "INSERT INTO registrations (event_id, user_id, status, requested_at) VALUES (?, ?, 'confirmed', ?)",
      [id, intruso.user.user_id, Date.now()],
    );

    const r1 = await del(env, id, intruso.cookie);
    assert.equal(r1.status, 403, r1.text);
    assert.equal(r1.json.error, "forbidden");
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM events")[0].n, 1);

    const r2 = await del(env, id, owner.cookie);
    assert.equal(r2.status, 204, r2.text);
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM events")[0].n, 0);
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM registrations")[0].n, 0, "inscrições removidas junto");
  });

  test("sem sessão → 401; Origin errado → 403; inexistente → 404", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id);
    const r1 = await del(env, id, undefined);
    assert.equal(r1.status, 401, r1.text);
    const r2 = await del(env, id, owner.cookie, { origin: "https://evil.example" });
    assert.equal(r2.status, 403, r2.text);
    assert.equal(r2.json.error, "invalid_origin");
    const r3 = await del(env, 9999, owner.cookie);
    assert.equal(r3.status, 404, r3.text);
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM events")[0].n, 1);
  });
});
