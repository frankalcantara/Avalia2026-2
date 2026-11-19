import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./fixture.mjs";
import { createSession } from "../functions/_shared/session.js";

const input = {
  origin: "Centro", destination: "Campus", departure_at: "2099-01-01T22:00:00-03:00", total_seats: 1,
};
function post(call, path, user, data) {
  return call(path, { method: "POST", user, body: JSON.stringify(data) });
}
async function create(call, data = input) {
  const response = await post(call, "/api/rides", "1", data);
  assert.equal(response.status, 201);
  return (await response.json()).ride;
}
function seats(db, id) {
  return db.prepare("SELECT available_seats FROM rides WHERE id = ?").get(id).available_seats;
}

test("OAuth2 valida state, troca código e identifica perfil via sessão", async (t) => {
  const { call } = await fixture();
  const start = await call("/api/auth/discord");
  assert.equal(start.status, 302);
  const url = new URL(start.headers.get("Location"));
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.searchParams.get("scope"), "identify");
  const state = url.searchParams.get("state");
  const cookie = start.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly; SameSite=Lax; Secure/);
  assert.equal(cookie.split(";")[0], "__Host-discord_oauth_state=" + state);
  const outbound = t.mock.method(globalThis, "fetch", async (target, options) => {
    if (target.endsWith("/token")) {
      assert.equal(options.body.get("code"), "test-code");
      assert.equal(options.body.get("redirect_uri"), url.searchParams.get("redirect_uri"));
      return Response.json({ access_token: "fixture" });
    }
    assert.equal(target, "https://discord.com/api/users/@me");
    assert.equal(options.headers.Authorization, "Bearer fixture");
    return Response.json({ id: "4", username: "Perfil Discord", avatar: null });
  });
  const path = "/api/auth/discord/callback?code=test-code&state=" + state;
  assert.match((await call(path)).headers.get("Location"), /invalid_state/);
  assert.match((await call(path, { cookie: cookie.replace(state, "0".repeat(64)) })).headers.get("Location"), /invalid_state/);
  assert.equal(outbound.mock.callCount(), 0);
  const result = await call(path, { cookie: cookie.split(";")[0] });
  assert.equal(result.headers.get("Location"), "/?login=success");
  assert.equal(outbound.mock.callCount(), 2);
  const [cleared, signed] = result.headers.getSetCookie();
  assert.match(cleared, /Max-Age=0$/);
  assert.match(signed, /HttpOnly; SameSite=Lax; Secure; Max-Age=86400/);
  const profile = await (await call("/api/status", { cookie: signed.split(";")[0] })).json();
  assert.equal(profile.sessionUser.userId, "4");
  assert.equal(profile.sessionUser.username, "Perfil Discord");
  outbound.mock.mockImplementation(async () => new Response(null, { status: 502 }));
  assert.match((await call(path, { cookie: cookie.split(";")[0] })).headers.get("Location"), /token_exchange_failed/);
});

test("rotas protegidas rejeitam visitantes, cookies inválidos, expirados e alterados", async (t) => {
  const { call, env, cookies } = await fixture();
  for (const [path, method] of [
    ["/api/rides", "POST"], ["/api/rides/1", "POST"], ["/api/rides/1", "GET"],
    ["/api/rides/mine", "GET"], ["/api/status", "POST"],
  ]) assert.equal((await call(path, { method })).status, 401);
  t.mock.method(Date, "now", () => +new Date("2000-01-01Z"));
  const expired = (await createSession(env, "1")).split(";")[0];
  const altered = cookies["1"].replace("=1.", "=2.");
  for (const cookie of [expired, altered, "__Host-discord_session=invalid"]) {
    assert.equal((await call("/api/rides/mine", { cookie })).status, 401);
    assert.equal((await (await call("/api/status", { cookie })).json()).sessionUser, null);
  }
});

test("cadastro valida campos, origem da requisição e identidade do motorista", async () => {
  const { call } = await fixture();
  assert.equal((await call("/api/rides", { method: "POST", user: "1", body: "{" })).status, 400);
  for (const patch of [{ total_seats: "2" }, { total_seats: 9 }, { total_seats: 1.5 },
    { origin: " " }, { destination: "x".repeat(121) }, { departure_at: "2099-02-30T22:00Z" },
    { departure_at: "2099-01-01T22:00" }, { departure_at: "2000-01-01T00:00Z" }]) {
    assert.equal((await post(call, "/api/rides", "1", { ...input, ...patch })).status, 400);
  }
  assert.equal((await call("/api/rides", {
    method: "POST", user: "1", origin: "https://other.test", body: JSON.stringify(input),
  })).status, 403);
  const ride = await create(call, { ...input, driver_id: "3", available_seats: 8 });
  assert.equal(ride.driver_id, "1");
  assert.equal(ride.available_seats, 1);
  assert.equal(ride.departure_at, "2099-01-02T01:00:00.000Z");
});

test("busca aplica dia de Brasília, horário, disponibilidade e filtros", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2099-01-02T00:00Z") });
  const { call, db } = await fixture();
  const ride = await create(call);
  await create(call, { ...input, departure_at: "2099-01-02T01:00:00-03:00" });
  db.exec(`INSERT INTO rides VALUES (10,'1','Centro','Campus','2099-01-01T23:00:00.000Z','2099-01-01',1,1),
    (11,'1','Centro','Campus','2099-01-02T01:00:00.000Z','2099-01-01',1,0)`);
  const search = async (query) => (await (await call("/api/rides?" + query)).json()).rides;
  assert.deepEqual((await search("origin=ENT&destination=camp")).map(({ id }) => id), [ride.id]);
  assert.deepEqual(await search("origin=Outro"), []);
  assert.deepEqual(await search("origin=" + encodeURIComponent("' OR 1=1")), []);
  assert.equal((await call("/api/rides?origin=" + "x".repeat(121))).status, 400);
});

test("disputa da última vaga, idempotência e rollback do gatilho", async () => {
  const { call, db } = await fixture();
  const ride = await create(call, { ...input, total_seats: 2 });
  const path = "/api/rides/" + ride.id;
  const first = await post(call, path, "2", { passenger_id: "3", available_seats: 8 });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).reservation.passenger_id, "2");
  assert.equal(seats(db, ride.id), 1);
  assert.equal((await post(call, path, "2")).status, 200);
  assert.equal(seats(db, ride.id), 1);
  assert.equal((await post(call, path, "1")).status, 403);
  const one = await create(call);
  const last = "/api/rides/" + one.id;
  const responses = await Promise.all(["2", "3"].map((id) => post(call, last, id)));
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  const loser = responses[0].status === 409 ? "2" : "3";
  const winner = loser === "2" ? "3" : "2";
  assert.equal((await post(call, last, winner)).status, 200);
  assert.throws(() => db.prepare("INSERT INTO ride_reservations (ride_id, passenger_id) VALUES (?, ?)").run(one.id, loser));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ride_reservations WHERE ride_id = ?").get(one.id).n, 1);
  assert.equal(seats(db, one.id), 0);
  db.prepare("UPDATE rides SET departure_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(ride.id);
  assert.equal((await post(call, path, "3")).status, 409);
});

test("passageiros e diagnósticos são isolados pela identidade", async () => {
  const { call } = await fixture();
  const ride = await create(call);
  const path = "/api/rides/" + ride.id;
  await post(call, path, "2");
  assert.equal((await call(path, { user: "2" })).status, 404);
  assert.deepEqual((await (await call(path, { user: "1" })).json()).passengers.map((p) => p.user_id), ["2"]);
  for (const user of ["1", "2"]) {
    const data = await (await call("/api/rides/mine", { user })).json();
    assert.equal(data.rides.length, user === "1" ? 1 : 0);
  }
  assert.equal((await post(call, "/api/status", "2", { conteudo: "Teste", user_id: "1" })).status, 201);
  assert.equal((await (await call("/api/status", { user: "1" })).json()).totalRegistros, 0);
  assert.equal((await (await call("/api/status", { user: "2" })).json()).ultimosRegistros[0].user_id, "2");
});

test("nova consulta conserva reserva própria mesmo lotada e protege a de terceiros", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2099-01-02T00:00Z") });
  const { call } = await fixture();
  const ride = await create(call);
  assert.equal((await post(call, "/api/rides/" + ride.id, "2")).status, 201);
  for (const user of ["2", "3", undefined]) {
    const response = await call("/api/rides?origin=Centro", { user });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const data = await response.json();
    assert.deepEqual(data.rides, []);
    assert.deepEqual(data.reservedRides.map(({ id }) => id), user === "2" ? [ride.id] : []);
  }
});

test("API sinaliza banco ausente e falhas internas com mensagens estáveis", async (t) => {
  const { call, env } = await fixture();
  delete env.DB;
  const unavailable = await call("/api/rides");
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { ok: false, error: "banco_indisponivel" });
  env.DB = { prepare() { throw new Error("detalhe interno da fixture"); } };
  const logged = t.mock.method(console, "error", () => {});
  const failure = await call("/api/rides");
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { ok: false, error: "falha_interna" });
  assert.equal(logged.mock.callCount(), 1);
});
