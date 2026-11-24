import test from "node:test";
import assert from "node:assert/strict";

import {
  getSession,
  makeSessionCookie,
  makeStateCookie,
  verifyOAuthState,
} from "../functions/_shared/auth.js";
import { onRequest as me } from "../functions/api/auth/me.js";
import { onRequest as items } from "../functions/api/items.js";
import { onRequest as movements } from "../functions/api/movements.js";
import { onRequest as startDiscordAuth } from "../functions/api/auth/discord.js";
import { onRequest as oauthCallback } from "../functions/api/auth/discord/callback.js";

const secret = "local-test-session-secret-that-is-at-least-32-characters";
const env = { SESSION_SECRET: secret };
const sessionUser = {
  user_id: "123456789",
  username: "test-user",
  avatar: "avatar_hash",
};

async function sessionCookie(user = sessionUser) {
  return (await makeSessionCookie(user, secret)).split(";")[0];
}

async function stateCookie(state) {
  return (await makeStateCookie(state, secret)).split(";")[0];
}

function request(path, { method = "GET", cookie, body, contentType } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  if (contentType) headers.set("Content-Type", contentType);
  return new Request(`https://almoxarifado.test${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

function responseBody(response) {
  return response.json();
}

test("Discord login redirects back with a clear setup message when local secrets are missing", async () => {
  const response = await startDiscordAuth({
    request: request("/api/auth/discord"),
    env: { SESSION_SECRET: secret },
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "https://almoxarifado.test/?auth_error=configuration");
  assert.equal(await response.text(), "");
});

function createDb({ itemId = 7, quantity = 5 } = {}) {
  const item = itemId === null ? null : {
    id: itemId,
    name: "Cabo HDMI",
    quantity,
  };
  const movementsById = new Map();
  let nextMovementId = 1;

  function prepare(sql) {
    const statement = {
      sql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async first() {
        if (this.sql.includes("SELECT id FROM items WHERE id = ?")) {
          return item && item.id === this.values[0] ? { id: item.id } : null;
        }
        if (this.sql.includes("WHERE movements.id = ?")) {
          const movement = movementsById.get(this.values[0]);
          return movement ? { ...movement, item_name: item.name } : null;
        }
        return null;
      },
      async all() {
        return {
          results: [...movementsById.values()].map((movement) => ({
            ...movement,
            item_name: item?.name,
          })),
        };
      },
    };
    return statement;
  }

  return {
    prepare,
    async batch(statements) {
      const [update, insert] = statements;
      const [quantityChange, targetId] = update.values;
      let changed = 0;
      if (item && item.id === targetId) {
        if (update.sql.startsWith("UPDATE items SET quantity = quantity - ?")) {
          if (item.quantity >= quantityChange) {
            item.quantity -= quantityChange;
            changed = 1;
          }
        } else if (item.quantity <= Number.MAX_SAFE_INTEGER - quantityChange) {
          item.quantity += quantityChange;
          changed = 1;
        }
      }

      const results = [{ meta: { changes: changed } }];
      if (changed) {
        const [item_id, type, quantity, user_id, username] = insert.values;
        const id = nextMovementId++;
        const movement = {
          id,
          item_id,
          type,
          quantity,
          user_id,
          username,
          created_at: "2026-01-01 00:00:00",
        };
        movementsById.set(id, movement);
        results.push({ meta: { last_row_id: id } });
        results.push({ results: [{ quantity: item.quantity }] });
      } else {
        results.push({ meta: {} });
        results.push({ results: [{ quantity: item?.quantity }] });
      }
      return results;
    },
  };
}

function createOAuthDb() {
  const writes = [];
  let user;
  return {
    writes,
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async run() {
          writes.push({ sql: this.sql, values: this.values });
          if (this.sql.includes("INSERT INTO users")) {
            const [id, discordId, username, avatar] = this.values;
            user = { id, discord_id: discordId, username, avatar };
          }
          return { success: true };
        },
        async first() {
          if (this.sql.includes("FROM users WHERE discord_id = ?")) {
            return user?.discord_id === this.values[0]
              ? { id: user.id, username: user.username, avatar: user.avatar }
              : null;
          }
          return null;
        },
      };
    },
  };
}

test("session cookie is HMAC-signed and rejects tampering or another secret", async () => {
  const cookie = await sessionCookie();
  const requestWithCookie = request("/api/auth/me", { cookie });
  assert.deepEqual(await getSession(requestWithCookie, env), sessionUser);

  const [name, value] = cookie.split("=");
  const [payload, signature] = value.split(".");
  const tampered = `${name}=${payload}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  assert.equal(await getSession(request("/api/auth/me", { cookie: tampered }), env), null);
  assert.equal(
    await getSession(request("/api/auth/me", { cookie }), {
      SESSION_SECRET: "a-different-valid-session-secret-that-is-long-enough",
    }),
    null,
  );
});

test("OAuth state accepts the signed state only and rejects altered or replayed callbacks", async () => {
  const state = "random-oauth-state";
  const cookie = await stateCookie(state);
  const matchingRequest = request("/api/auth/discord/callback", { cookie });
  assert.equal(await verifyOAuthState(matchingRequest, state, secret), true);
  assert.equal(await verifyOAuthState(matchingRequest, `${state}-altered`, secret), false);
  const [cookieName, cookieValue] = cookie.split("=");
  const [payload, signature] = cookieValue.split(".");
  const alteredCookie = `${cookieName}=${payload}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  assert.equal(
    await verifyOAuthState(request("/api/auth/discord/callback", { cookie: alteredCookie }), state, secret),
    false,
  );
  assert.equal(
    await verifyOAuthState(request("/api/auth/discord/callback"), state, secret),
    false,
  );

  const alteredResponse = await oauthCallback({
    request: request(`/api/auth/discord/callback?code=unused&state=${state}-altered`, { cookie }),
    env: { ...env, DISCORD_CLIENT_ID: "local", DISCORD_CLIENT_SECRET: "local" },
  });
  assert.equal(alteredResponse.status, 400);

  const replayResponse = await oauthCallback({
    request: request(`/api/auth/discord/callback?code=unused&state=${state}`),
    env: { ...env, DISCORD_CLIENT_ID: "local", DISCORD_CLIENT_SECRET: "local" },
  });
  assert.equal(replayResponse.status, 400);
});

test("OAuth callback persists the provider identity and returns a verifiable session without network access", async () => {
  const state = "successful-oauth-state";
  const db = createOAuthDb();
  const calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://discord.com/api/oauth2/token") {
      return Response.json({ access_token: "local-test-access-token" });
    }
    if (url === "https://discord.com/api/users/@me") {
      return Response.json({
        id: "987654321",
        username: "oauth-user",
        avatar: "a_avatarHash",
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const response = await oauthCallback({
      request: request(`/api/auth/discord/callback?code=local-code&state=${state}`, {
        cookie: await stateCookie(state),
      }),
      env: {
        ...env,
        DB: db,
        DISCORD_CLIENT_ID: "local-client-id",
        DISCORD_CLIENT_SECRET: "local-client-secret",
      },
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/");
    assert.deepEqual(calls.map(({ url }) => url), [
      "https://discord.com/api/oauth2/token",
      "https://discord.com/api/users/@me",
    ]);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(new URLSearchParams(calls[0].init.body).get("code"), "local-code");
    assert.equal(calls[1].init.headers.Authorization, "Bearer local-test-access-token");

    assert.equal(db.writes.length, 1);
    assert.match(db.writes[0].sql, /INSERT INTO users/);
    assert.deepEqual(db.writes[0].values, [
      "987654321",
      "987654321",
      "oauth-user",
      "https://cdn.discordapp.com/avatars/987654321/a_avatarHash.gif",
    ]);

    const cookies = response.headers.getSetCookie();
    const session = cookies.find((value) =>
      value.startsWith("__Host-almoxarifado_session=") &&
      !value.startsWith("__Host-almoxarifado_session=;"),
    );
    assert.ok(session, "callback should issue a session cookie");
    assert.match(session, /HttpOnly/);
    assert.match(session, /Secure/);
    const parsedSession = await getSession(
      request("/api/auth/me", { cookie: session.split(";")[0] }),
      env,
    );
    assert.deepEqual(
      parsedSession,
      {
        user_id: "987654321",
        username: "oauth-user",
        avatar: "https://cdn.discordapp.com/avatars/987654321/a_avatarHash.gif",
      },
      `session cookie should be verifiable: ${session}`,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("/api/auth/me returns the documented authenticated user shape", async () => {
  const response = await me({
    request: request("/api/auth/me", { cookie: await sessionCookie() }),
    env,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await responseBody(response), {
    authenticated: true,
    user: { id: sessionUser.user_id, username: sessionUser.username, avatar: sessionUser.avatar },
  });
});

test("protected item and movement APIs reject requests without a session", async () => {
  assert.equal((await items({ request: request("/api/items"), env: { ...env, DB: createDb() } })).status, 401);
  assert.equal((await movements({ request: request("/api/movements"), env: { ...env, DB: createDb() } })).status, 401);
  assert.equal((await movements({
    request: request("/api/movements", { method: "POST", body: "{}" }),
    env: { ...env, DB: createDb() },
  })).status, 401);
});

test("movement payload validation rejects malformed, out-of-range, and client identity data", async () => {
  const cookie = await sessionCookie();
  const db = createDb();
  const invalidCases = [
    { body: "{", contentType: "application/json" },
    { body: "{}", contentType: "text/plain" },
    { body: JSON.stringify({ item_id: 7, type: "withdrawal", quantity: 1, user_id: "attacker" }), contentType: "application/json" },
    { body: JSON.stringify({ item_id: 7, type: "withdrawal", quantity: 1, identity: "attacker" }), contentType: "application/json" },
    { body: JSON.stringify({ item_id: 7, type: "withdrawal", quantity: 0 }), contentType: "application/json" },
    { body: JSON.stringify({ item_id: 7, type: "transfer", quantity: 1 }), contentType: "application/json" },
    { body: JSON.stringify({ item_id: 1.5, type: "return", quantity: 1 }), contentType: "application/json" },
  ];

  for (const invalid of invalidCases) {
    const response = await movements({
      request: request("/api/movements", { method: "POST", cookie, ...invalid }),
      env: { ...env, DB: db },
    });
    assert.equal(response.status, 400, `expected invalid payload to fail: ${invalid.body}`);
  }
});

test("movements return 404 for missing items, 409 for insufficient stock, and 201 on success", async () => {
  const cookie = await sessionCookie();
  const authenticatedEnv = (DB) => ({ ...env, DB });
  const postMovement = (body, DB) => movements({
    request: request("/api/movements", {
      method: "POST",
      cookie,
      body: JSON.stringify(body),
      contentType: "application/json",
    }),
    env: authenticatedEnv(DB),
  });

  assert.equal((await postMovement({ item_id: 999, type: "return", quantity: 1 }, createDb())).status, 404);
  assert.equal((await postMovement({ item_id: 7, type: "withdrawal", quantity: 6 }, createDb())).status, 409);

  const db = createDb({ quantity: 5 });
  const success = await postMovement({ item_id: 7, type: "withdrawal", quantity: 2 }, db);
  assert.equal(success.status, 201);
  const result = await responseBody(success);
  assert.equal(result.balance, 3);
  assert.equal(result.movement.user_id, sessionUser.user_id);
  assert.equal(result.movement.username, sessionUser.username);
  assert.equal(result.movement.type, "withdrawal");
  assert.equal(result.movement.quantity, 2);
});

test("successful return increases the balance and attributes the movement to the session user", async () => {
  const cookie = await sessionCookie();
  const db = createDb({ quantity: 5 });
  const response = await movements({
    request: request("/api/movements", {
      method: "POST",
      cookie,
      body: JSON.stringify({ item_id: 7, type: "return", quantity: 3 }),
      contentType: "application/json",
    }),
    env: { ...env, DB: db },
  });

  assert.equal(response.status, 201);
  const result = await responseBody(response);
  assert.equal(result.balance, 8);
  assert.deepEqual(
    {
      user_id: result.movement.user_id,
      username: result.movement.username,
      type: result.movement.type,
      quantity: result.movement.quantity,
    },
    {
      user_id: sessionUser.user_id,
      username: sessionUser.username,
      type: "return",
      quantity: 3,
    },
  );
});
