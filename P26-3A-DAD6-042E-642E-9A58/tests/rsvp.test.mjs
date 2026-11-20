// Núcleo do projeto: lotação, fila de espera, promoção e concorrência.
// Fonte da verdade: docs/contrato-api.md ("Regra da fila").

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  allRoutesExist,
  call,
  counts,
  insertEvent,
  load,
  login,
  makeEnv,
  spDate,
} from "./helpers/app.mjs";

const ready = allRoutesExist("event", "rsvp");
const opts = ready ? {} : { skip: "functions/api/events/[id].js ou [id]/rsvp.js ainda não existe" };

async function rsvp(env, eventId, cookie, extra = {}) {
  const mod = await load("rsvp");
  return call(mod, "POST", {
    env,
    path: `/api/events/${eventId}/rsvp`,
    params: { id: String(eventId) },
    cookie,
    ...extra,
  });
}

async function cancel(env, eventId, cookie) {
  const mod = await load("rsvp");
  return call(mod, "DELETE", {
    env,
    path: `/api/events/${eventId}/rsvp`,
    params: { id: String(eventId) },
    cookie,
  });
}

async function detail(env, eventId, cookie) {
  const mod = await load("event");
  return call(mod, "GET", {
    env,
    path: `/api/events/${eventId}`,
    params: { id: String(eventId) },
    cookie,
  });
}

function regOf(env, eventId, userId) {
  return env.DB.query(
    "SELECT * FROM registrations WHERE event_id = ? AND user_id = ?",
    [eventId, userId],
  )[0];
}

function assertInvariant(env, eventId) {
  const c = counts(env, eventId);
  assert.ok(
    c.confirmed <= c.capacity,
    `invariante violada: ${c.confirmed} confirmados > capacidade ${c.capacity}`,
  );
  if (c.waitlist > 0) {
    assert.equal(c.confirmed, c.capacity, "há gente na fila com vaga sobrando");
  }
  return c;
}

describe("RSVP: lotação e fila de espera", opts, () => {
  test("capacidade 2 e três inscrições: 2 confirmed e 1 waitlist na posição 1", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 2 });
    const [a, b, c] = [await login(env), await login(env), await login(env)];

    const ra = await rsvp(env, id, a.cookie);
    const rb = await rsvp(env, id, b.cookie);
    const rc = await rsvp(env, id, c.cookie);

    assert.equal(ra.status, 201, ra.text);
    assert.equal(rb.status, 201, rb.text);
    assert.equal(rc.status, 201, rc.text);
    assert.equal(ra.json.status, "confirmed");
    assert.equal(rb.json.status, "confirmed");
    assert.equal(rc.json.status, "waitlist");
    assert.equal(rc.json.position, 1);
    assert.equal(ra.json.position ?? null, null, "confirmado não tem posição na fila");

    // EventSummary devolvido junto
    assert.equal(rc.json.event.id, id);
    assert.equal(rc.json.event.confirmed_count, 2);
    assert.equal(rc.json.event.waitlist_count, 1);
    assert.equal(rc.json.event.spots_left, 0);
    assert.equal(rc.json.event.my_status, "waitlist");
    assert.equal(rc.json.event.my_position, 1);

    assert.deepEqual(counts(env, id), { confirmed: 2, waitlist: 1, capacity: 2 });
    assertInvariant(env, id);
  });

  test("detalhe lista confirmados e fila com position 1-based", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 1 });
    const us = [];
    for (let i = 0; i < 4; i++) {
      const u = await login(env);
      us.push(u);
      assert.equal((await rsvp(env, id, u.cookie)).status, 201);
    }
    const d = await detail(env, id, us[2].cookie);
    assert.equal(d.status, 200, d.text);
    assert.deepEqual(d.json.confirmed.map((x) => x.user_id), [us[0].user.user_id]);
    assert.deepEqual(
      d.json.waitlist.map((x) => [x.user_id, x.position]),
      [
        [us[1].user.user_id, 1],
        [us[2].user.user_id, 2],
        [us[3].user.user_id, 3],
      ],
    );
    assert.equal(d.json.event.my_status, "waitlist");
    assert.equal(d.json.event.my_position, 2);
    for (const att of [...d.json.confirmed, ...d.json.waitlist]) {
      assert.ok("username" in att && "avatar_url" in att && "requested_at" in att, JSON.stringify(att));
    }
  });

  test("ordem da fila segue requested_at (quem pediu antes fica na frente), desempate por id", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 1 });
    const a = await login(env);
    const b = await login(env);
    const c = await login(env);
    await rsvp(env, id, a.cookie); // confirmado
    await rsvp(env, id, b.cookie); // fila (id menor)
    await rsvp(env, id, c.cookie); // fila (id maior)
    // C pediu antes de B (requested_at menor) apesar de ter id maior.
    env.DB.query("UPDATE registrations SET requested_at = 1000 WHERE user_id = ?", [b.user.user_id]);
    env.DB.query("UPDATE registrations SET requested_at = 500 WHERE user_id = ?", [c.user.user_id]);

    const d = await detail(env, id);
    assert.equal(d.status, 200, d.text);
    assert.deepEqual(
      d.json.waitlist.map((x) => x.user_id),
      [c.user.user_id, b.user.user_id],
      "fila deve ser ordenada por requested_at",
    );

    // Promoção também respeita requested_at: A cancela, C é promovido.
    const r = await cancel(env, id, a.cookie);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.promoted_user_id, c.user.user_id);

    // Empate em requested_at: vale o menor id.
    const id2 = insertEvent(env, owner.user.user_id, { capacity: 1 });
    const x = await login(env);
    const y = await login(env);
    const z = await login(env);
    await rsvp(env, id2, x.cookie);
    await rsvp(env, id2, y.cookie);
    await rsvp(env, id2, z.cookie);
    env.DB.query("UPDATE registrations SET requested_at = 777 WHERE event_id = ?", [id2]);
    const d2 = await detail(env, id2);
    assert.deepEqual(d2.json.waitlist.map((w) => w.user_id), [y.user.user_id, z.user.user_id]);
  });

  test("status decidido pelo servidor: corpo com status/user_id é ignorado", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 1 });
    const a = await login(env);
    const b = await login(env);
    await rsvp(env, id, a.cookie);
    const r = await rsvp(env, id, b.cookie, {
      body: { status: "confirmed", user_id: owner.user.user_id, position: 0 },
    });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.status, "waitlist", "cliente não pode se auto-confirmar");
    assert.equal(regOf(env, id, b.user.user_id)?.status, "waitlist");
    assert.equal(regOf(env, id, owner.user.user_id), undefined, "user_id do corpo não pode ser usado");
    assertInvariant(env, id);
  });

  test("duplicidade: segunda inscrição do mesmo usuário → 409 already_registered", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 5 });
    const a = await login(env);
    assert.equal((await rsvp(env, id, a.cookie)).status, 201);
    const r = await rsvp(env, id, a.cookie);
    assert.equal(r.status, 409, r.text);
    assert.equal(r.json.error, "already_registered");
    assert.equal(typeof r.json.message, "string");
    assert.equal(counts(env, id).confirmed, 1);
  });

  test("evento passado → 409 event_closed", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { date: spDate(-2), capacity: 5 });
    const a = await login(env);
    const r = await rsvp(env, id, a.cookie);
    assert.equal(r.status, 409, r.text);
    assert.equal(r.json.error, "event_closed");
    assert.equal(counts(env, id).confirmed, 0);
  });

  test("evento inexistente → 404", async () => {
    const env = await makeEnv();
    const a = await login(env);
    const r = await rsvp(env, 999, a.cookie);
    assert.equal(r.status, 404, r.text);
  });
});

describe("RSVP: cancelamento e promoção", opts, () => {
  test("confirmado cancela → primeiro da fila vira confirmed com promoted_at", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 2 });
    const [a, b, c, d] = [await login(env), await login(env), await login(env), await login(env)];
    for (const u of [a, b, c, d]) assert.equal((await rsvp(env, id, u.cookie)).status, 201);

    const r = await cancel(env, id, a.cookie);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.cancelled, true);
    assert.equal(r.json.promoted_user_id, c.user.user_id);
    assert.equal(r.json.event.confirmed_count, 2);
    assert.equal(r.json.event.waitlist_count, 1);
    assert.equal(r.json.event.my_status, null);

    assert.equal(regOf(env, id, a.user.user_id), undefined);
    const rc = regOf(env, id, c.user.user_id);
    assert.equal(rc.status, "confirmed");
    assert.ok(Number.isInteger(rc.promoted_at) && rc.promoted_at > 0, "promoted_at gravado");
    assert.equal(regOf(env, id, b.user.user_id).promoted_at, null);

    // D sobe para a posição 1
    const det = await detail(env, id, d.cookie);
    assert.equal(det.json.event.my_position, 1);
    assert.deepEqual(det.json.waitlist.map((w) => [w.user_id, w.position]), [[d.user.user_id, 1]]);
    assertInvariant(env, id);
  });

  test("confirmado cancela sem fila → promoted_user_id null e vaga volta", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 2 });
    const a = await login(env);
    await rsvp(env, id, a.cookie);
    const r = await cancel(env, id, a.cookie);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.promoted_user_id, null);
    assert.equal(r.json.event.spots_left, 2);
  });

  test("cancelar da fila não promove ninguém e reordena as posições", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 1 });
    const [a, b, c, d] = [await login(env), await login(env), await login(env), await login(env)];
    for (const u of [a, b, c, d]) await rsvp(env, id, u.cookie);

    const r = await cancel(env, id, b.cookie); // b estava na posição 1
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.promoted_user_id, null, "cancelar da fila não promove");
    assert.deepEqual(counts(env, id), { confirmed: 1, waitlist: 2, capacity: 1 });
    assert.equal(regOf(env, id, a.user.user_id).status, "confirmed");
    assert.equal(regOf(env, id, c.user.user_id).status, "waitlist");
    assert.equal(regOf(env, id, c.user.user_id).promoted_at, null);

    const det = await detail(env, id, d.cookie);
    assert.deepEqual(
      det.json.waitlist.map((w) => [w.user_id, w.position]),
      [
        [c.user.user_id, 1],
        [d.user.user_id, 2],
      ],
    );
    assert.equal(det.json.event.my_position, 2);
    assertInvariant(env, id);
  });

  test("cancelar sem estar inscrito → 404 not_registered", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 1 });
    const a = await login(env);
    const r = await cancel(env, id, a.cookie);
    assert.equal(r.status, 404, r.text);
    assert.equal(r.json.error, "not_registered");
  });

  test("sequência longa de inscrições e cancelamentos mantém o invariante", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 3 });
    const users = [];
    for (let i = 0; i < 8; i++) users.push(await login(env));
    for (const u of users) await rsvp(env, id, u.cookie);
    assertInvariant(env, id);
    // cancela em ordem embaralhada (mistura confirmados e fila)
    for (const i of [0, 5, 1, 7, 2]) {
      const r = await cancel(env, id, users[i].cookie);
      assert.equal(r.status, 200, r.text);
      assertInvariant(env, id);
    }
    assert.deepEqual(counts(env, id), { confirmed: 3, waitlist: 0, capacity: 3 });
    // sobram 3, 4, 6 confirmados (na ordem da fila)
    const conf = env.DB.query(
      "SELECT user_id FROM registrations WHERE event_id = ? AND status='confirmed' ORDER BY user_id",
      [id],
    ).map((r) => r.user_id);
    assert.deepEqual(conf, [users[3], users[4], users[6]].map((u) => u.user.user_id).sort());
  });
});

describe("RSVP: concorrência", opts, () => {
  test("12 inscrições em paralelo (Promise.all) nunca passam da capacidade 3", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 3 });
    const users = [];
    for (let i = 0; i < 12; i++) users.push(await login(env));

    const results = await Promise.all(users.map((u) => rsvp(env, id, u.cookie)));
    for (const r of results) assert.equal(r.status, 201, r.text);
    const confirmed = results.filter((r) => r.json.status === "confirmed").length;
    assert.equal(confirmed, 3, "exatamente 3 respostas confirmed");
    const positions = results
      .filter((r) => r.json.status === "waitlist")
      .map((r) => r.json.position)
      .sort((x, y) => x - y);
    assert.equal(positions.length, 9);
    assert.deepEqual(new Set(positions).size, 9, `posições repetidas: ${positions}`);
    assert.deepEqual(counts(env, id), { confirmed: 3, waitlist: 9, capacity: 3 });
  });

  test("mesmo usuário dispara 5 inscrições em paralelo: 1 aceita, 4 → 409", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 10 });
    const a = await login(env);
    const results = await Promise.all(Array.from({ length: 5 }, () => rsvp(env, id, a.cookie)));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409], results.map((r) => r.text).join("\n"));
    assert.equal(counts(env, id).confirmed, 1);
  });

  test("cancelamentos em paralelo promovem sem estourar a capacidade", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id, { capacity: 2 });
    const users = [];
    for (let i = 0; i < 6; i++) users.push(await login(env));
    for (const u of users) await rsvp(env, id, u.cookie);

    // os 2 confirmados e o 1º da fila cancelam ao mesmo tempo, junto com novas inscrições
    const extra = [await login(env), await login(env)];
    const results = await Promise.all([
      cancel(env, id, users[0].cookie),
      cancel(env, id, users[1].cookie),
      cancel(env, id, users[2].cookie),
      rsvp(env, id, extra[0].cookie),
      rsvp(env, id, extra[1].cookie),
    ]);
    for (const r of results) assert.ok([200, 201].includes(r.status), r.text);
    const c = assertInvariant(env, id);
    assert.equal(c.confirmed, 2);
    assert.equal(c.confirmed + c.waitlist, 5);
  });
});
