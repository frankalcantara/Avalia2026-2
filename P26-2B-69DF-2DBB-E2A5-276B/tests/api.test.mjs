import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/[[path]].js";
import { distribuir, embaralhar, sha256 } from "../lib/sorteio.mjs";
import { testDatabase } from "./d1-adapter.mjs";

const origin = "https://sorteador.example";
async function setup() {
  const { DB, sqlite } = testDatabase();
  const ownerToken = "a".repeat(64);
  const studentToken = "b".repeat(64);
  sqlite
    .prepare("INSERT INTO discord_users(user_id,username) VALUES(?,?)")
    .run("100", "Professora");
  sqlite
    .prepare("INSERT INTO discord_users(user_id,username) VALUES(?,?)")
    .run("200", "Aluna");
  for (const [token, id] of [
    [ownerToken, "100"],
    [studentToken, "200"],
  ]) {
    sqlite
      .prepare(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      )
      .run(await sha256(token), id, Math.floor(Date.now() / 1000) + 1000);
  }
  const env = {
    DB,
    DISCORD_CLIENT_ID: "client",
    DISCORD_CLIENT_SECRET: "secret",
  };
  async function call(
    path,
    { method = "GET", token, data, requestOrigin = origin, cookie } = {},
  ) {
    const headers = new Headers();
    if (method !== "GET" && requestOrigin) headers.set("Origin", requestOrigin);
    if (token || cookie)
      headers.set("Cookie", cookie || `sorteio_session=${token}`);
    if (data !== undefined) headers.set("Content-Type", "application/json");
    return onRequest({
      env,
      request: new Request(origin + path, {
        method,
        headers,
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
    });
  }
  async function create(overrides = {}) {
    const response = await call("/api/rooms", {
      method: "POST",
      token: ownerToken,
      data: {
        title: "Seminário",
        mode: "equipes",
        max_size: 3,
        participants: ["Ana", "Bia", "Caio", "Davi", "Eva", "Fábio", "Gabi"],
        ...overrides,
      },
    });
    assert.equal(response.status, 201);
    return (await response.json()).room;
  }
  return { DB, sqlite, call, create, ownerToken, studentToken };
}

test("shuffle preserves original list and balanced groups preserve everyone", () => {
  const input = Array.from({ length: 19 }, (_, i) => ({ id: String(i) }));
  const before = JSON.stringify(input);
  for (let repetition = 0; repetition < 100; repetition++) {
    const shuffled = embaralhar(input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(
      shuffled.map((p) => p.id).sort(),
      input.map((p) => p.id).sort(),
    );
    const groups = distribuir(input, "equipes", 4);
    assert.equal(groups.length, 5);
    assert.ok(groups.every((group) => group.length <= 4));
    assert.ok(
      Math.max(...groups.map((g) => g.length)) -
        Math.min(...groups.map((g) => g.length)) <=
        1,
    );
    assert.equal(new Set(groups.flat().map((p) => p.id)).size, 19);
  }
  assert.ok(distribuir(input, "ordem", 1).every((group) => group.length === 1));
});

test("session rejects forged legacy cookies, forged and expired opaque tokens", async () => {
  const s = await setup();
  assert.equal((await (await s.call("/api/me")).json()).user, null);
  const forgedLegacy =
    "discord_session=" + btoa(JSON.stringify({ userId: "100" }));
  assert.equal(
    (await (await s.call("/api/me", { cookie: forgedLegacy })).json()).user,
    null,
  );
  assert.equal(
    (await (await s.call("/api/me", { token: "c".repeat(64) })).json()).user,
    null,
  );
  assert.equal(
    (await (await s.call("/api/me", { token: s.ownerToken })).json()).user
      .user_id,
    "100",
  );
  s.sqlite.prepare("UPDATE sessions SET expires_at=0").run();
  assert.equal(
    (await (await s.call("/api/me", { token: s.ownerToken })).json()).user,
    null,
  );
});

test("mutations require same origin, authenticated organizer and valid payload", async () => {
  const s = await setup();
  assert.equal(
    (await s.call("/api/rooms", { method: "POST", data: {} })).status,
    401,
  );
  assert.equal(
    (
      await s.call("/api/rooms", {
        method: "POST",
        token: s.ownerToken,
        data: {},
        requestOrigin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await s.call("/api/rooms", {
        method: "POST",
        token: s.ownerToken,
        data: {},
        requestOrigin: null,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await s.call("/api/rooms", {
        method: "POST",
        token: s.ownerToken,
        data: {},
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await s.call("/api/rooms", {
        method: "POST",
        token: s.ownerToken,
        data: null,
      })
    ).status,
    400,
  );
  const room = await s.create();
  for (const action of ["draw", "participants"]) {
    assert.equal(
      (
        await s.call(`/api/rooms/${room.id}/${action}`, {
          method: "POST",
          token: s.studentToken,
          data: { name: "Intrusa" },
        })
      ).status,
      403,
    );
  }
});

test("join idempotent, immutable public receipt, retry and concurrent draw", async () => {
  const s = await setup();
  const room = await s.create();
  const path = `/api/rooms/${room.id}`;
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await s.call(path + "/join", { method: "POST", token: s.studentToken }))
        .status,
      200,
    );
  assert.equal((await (await s.call(path)).json()).participants.length, 8);
  const responses = await Promise.all([
    s.call(path + "/draw", { method: "POST", token: s.ownerToken }),
    s.call(path + "/draw", { method: "POST", token: s.ownerToken }),
  ]);
  for (const response of responses) assert.equal(response.status, 200);
  const draws = await Promise.all(responses.map((response) => response.json()));
  assert.equal(draws[0].draw.code, draws[1].draw.code);
  const draw = draws[0].draw;
  assert.equal(await sha256(JSON.stringify(draw.payload)), draw.hash);
  assert.equal(draw.payload.participants.length, 8);
  assert.equal(new Set(draw.payload.result.flat().map((p) => p.id)).size, 8);
  assert.ok(draw.payload.result.every((group) => group.length <= 3));
  const publicResponse = await s.call("/api/draws/" + draw.code);
  assert.equal(publicResponse.status, 200);
  assert.equal((await publicResponse.json()).draw.hash, draw.hash);
  assert.equal(
    (await s.call(path + "/join", { method: "POST", token: s.studentToken }))
      .status,
    409,
  );
  assert.equal(
    (
      await s.call(path + "/participants", {
        method: "POST",
        token: s.ownerToken,
        data: { name: "Tardia" },
      })
    ).status,
    409,
  );
  const participant = draw.payload.participants[0];
  assert.equal(
    (
      await s.call(path + "/participants/" + participant.id, {
        method: "DELETE",
        token: s.ownerToken,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await (
        await s.call(path + "/draw", { method: "POST", token: s.ownerToken })
      ).json()
    ).draw.code,
    draw.code,
  );
  assert.throws(
    () =>
      s.sqlite
        .prepare("UPDATE draws SET hash=? WHERE code=?")
        .run("tamper", draw.code),
    /imutável/,
  );
  assert.throws(
    () => s.sqlite.prepare("DELETE FROM draws WHERE code=?").run(draw.code),
    /imutável/,
  );
  assert.throws(
    () =>
      s.sqlite
        .prepare("UPDATE participants SET name=? WHERE id=?")
        .run("tamper", participant.id),
    /encerrado/,
  );
});

test("too few participants and invalid maximum rejected, removal scoped to room", async () => {
  const s = await setup();
  const room = await s.create({ participants: ["Ana"] });
  assert.equal(
    (
      await s.call(`/api/rooms/${room.id}/draw`, {
        method: "POST",
        token: s.ownerToken,
      })
    ).status,
    400,
  );
  const other = await s.create({ participants: ["Outra"] });
  const otherPeople = (await (await s.call(`/api/rooms/${other.id}`)).json())
    .participants;
  const deletion = await s.call(
    `/api/rooms/${room.id}/participants/${otherPeople[0].id}`,
    { method: "DELETE", token: s.ownerToken },
  );
  assert.equal(deletion.status, 200);
  assert.equal(
    (await (await s.call(`/api/rooms/${other.id}`)).json()).participants.length,
    1,
  );
  for (const max_size of [0, 101, 2.5, "4"]) {
    assert.equal(
      (
        await s.call("/api/rooms", {
          method: "POST",
          token: s.ownerToken,
          data: { title: "X", mode: "equipes", max_size, participants: [] },
        })
      ).status,
      400,
    );
  }
});

test("OAuth state is bound to cookie, expires and cannot be reused", async () => {
  const s = await setup();
  const login = await s.call("/api/auth/discord?returnTo=//evil.example");
  assert.equal(login.status, 302);
  const target = new URL(login.headers.get("Location"));
  assert.equal(target.origin, "https://discord.com");
  assert.equal(target.searchParams.get("scope"), "identify");
  const state = target.searchParams.get("state");
  assert.match(
    login.headers.get("Set-Cookie"),
    /HttpOnly.*SameSite=Lax.*Secure/,
  );
  assert.equal(
    (
      await s.call(
        "/api/auth/discord/callback?state=" + state + "&error=access_denied",
      )
    ).status,
    400,
  );
  const cookie = `sorteio_oauth=${state}`;
  assert.equal(
    (
      await s.call(
        "/api/auth/discord/callback?state=" + state + "&error=access_denied",
        { cookie },
      )
    ).status,
    302,
  );
  assert.equal(
    (
      await s.call(
        "/api/auth/discord/callback?state=" + state + "&error=access_denied",
        { cookie },
      )
    ).status,
    400,
  );
});

test("OAuth successful exchange stores hashed session and returns to room", async () => {
  const s = await setup();
  const returnTo = "/?room=sample";
  const login = await s.call(
    "/api/auth/discord?returnTo=" + encodeURIComponent(returnTo),
  );
  const state = new URL(login.headers.get("Location")).searchParams.get(
    "state",
  );
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    if (url.endsWith("/oauth2/token")) {
      assert.equal(options.body.get("code"), "valid-code");
      return Response.json({ access_token: "discord-token" });
    }
    assert.equal(options.headers.Authorization, "Bearer discord-token");
    return Response.json({
      id: "300",
      username: "nova_aluna",
      global_name: "Nova Aluna",
      avatar: null,
    });
  };
  try {
    const callback = await s.call(
      `/api/auth/discord/callback?state=${state}&code=valid-code`,
      { cookie: `sorteio_oauth=${state}` },
    );
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get("Location"), returnTo);
    const sessionCookie = callback.headers
      .getSetCookie()
      .find((value) => value.startsWith("sorteio_session="));
    assert.ok(sessionCookie);
    const raw = sessionCookie.split(";")[0].split("=")[1];
    const saved = s.sqlite
      .prepare("SELECT * FROM sessions WHERE user_id=?")
      .get("300");
    assert.equal(saved.token_hash, await sha256(raw));
    assert.notEqual(saved.token_hash, raw);
    assert.equal(
      (await (await s.call("/api/me", { token: raw })).json()).user.username,
      "Nova Aluna",
    );
    assert.equal(requests, 2);
    assert.equal(
      (await s.call("/api/logout", { method: "POST", token: raw })).status,
      200,
    );
    assert.equal(
      (await (await s.call("/api/me", { token: raw })).json()).user,
      null,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("changed participant snapshot rejects a draw and expired OAuth state rejected", async () => {
  const s = await setup();
  const room = await s.create();
  const originalPrepare = s.DB.prepare.bind(s.DB);
  let changed = false;
  s.DB.prepare = (sql) => {
    if (sql.startsWith("INSERT INTO draws") && !changed) {
      changed = true;
      s.sqlite
        .prepare(
          "INSERT INTO participants(id,room_id,name,created_at) VALUES(?,?,?,?)",
        )
        .run(
          crypto.randomUUID(),
          room.id,
          "Entrada concorrente",
          new Date().toISOString(),
        );
    }
    return originalPrepare(sql);
  };
  const result = await s.call(`/api/rooms/${room.id}/draw`, {
    method: "POST",
    token: s.ownerToken,
  });
  assert.equal(result.status, 409);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) n FROM draws").get().n, 0);
  const login = await s.call("/api/auth/discord");
  const state = new URL(login.headers.get("Location")).searchParams.get(
    "state",
  );
  s.sqlite.prepare("UPDATE oauth_states SET expires_at=0").run();
  assert.equal(
    (
      await s.call(`/api/auth/discord/callback?state=${state}&code=x`, {
        cookie: `sorteio_oauth=${state}`,
      })
    ).status,
    400,
  );
});
