import test from "node:test";
import assert from "node:assert/strict";

import { getSession, makeSessionCookie, verifyPassword } from "../functions/_shared/auth.js";
import { onRequest as me } from "../functions/api/auth/me.js";
import { onRequest as register } from "../functions/api/auth/register.js";
import { onRequest as login } from "../functions/api/auth/login.js";
import { onRequest as items } from "../functions/api/items.js";

const secret = "local-test-session-secret-that-is-at-least-32-characters";
const envWithoutDb = { SESSION_SECRET: secret };
const password = "correct horse battery staple";

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

function postJson(path, body, cookie) {
  return request(path, {
    method: "POST",
    cookie,
    body: JSON.stringify(body),
    contentType: "application/json",
  });
}

function createAuthDb() {
  const usersByEmail = new Map();
  const writes = [];
  let nextUserId = 1;

  function prepare(sql) {
    const statement = {
      sql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async first() {
        if (this.sql.includes("FROM users WHERE email = ?")) {
          const user = usersByEmail.get(this.values[0]);
          if (!user) return null;
          if (this.sql.includes("password_hash")) return { ...user };
          return { id: user.id };
        }
        return null;
      },
      async run() {
        writes.push({ sql: this.sql, values: this.values });
        if (!this.sql.includes("INSERT INTO users")) return { meta: { changes: 1 } };

        const [id, email, username, passwordSalt, passwordHash] = this.values;
        if (usersByEmail.has(email)) return { meta: { changes: 0 } };
        const user = {
          id: id || `local-test-user-${nextUserId++}`,
          email,
          username,
          avatar: null,
          password_salt: passwordSalt,
          password_hash: passwordHash,
        };
        usersByEmail.set(email, user);
        return { meta: { changes: 1 } };
      },
    };
    return statement;
  }

  return { prepare, usersByEmail, writes };
}

function createItemsDb() {
  const insertedItems = [];
  const itemsById = new Map();
  let nextItemId = 900;

  function prepare(sql) {
    return {
      sql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async run() {
        if (!this.sql.includes("INSERT INTO items")) return { meta: { changes: 1 } };
        const columns = this.sql.match(/\(([^)]+)\)\s*VALUES/i)?.[1]
          .split(",")
          .map((column) => column.trim());
        assert.ok(columns, "item insert should name persisted columns");
        const row = Object.fromEntries(columns.map((column, index) => [column, this.values[index]]));
        if (insertedItems.some((item) => item.name === row.name)) {
          return { meta: { changes: 0 } };
        }
        const id = nextItemId++;
        const item = { id, ...row };
        insertedItems.push(item);
        itemsById.set(id, item);
        return { meta: { changes: 1, last_row_id: id } };
      },
      async first() {
        if (this.sql.includes("FROM items WHERE id = ?")) {
          return itemsById.get(this.values[0]) || null;
        }
        return null;
      },
    };
  }

  return { prepare, insertedItems };
}

async function cookieFrom(response) {
  const cookie = response.headers.getSetCookie().find((value) =>
    value.startsWith("__Host-almoxarifado_session=") &&
    !value.startsWith("__Host-almoxarifado_session=;"),
  );
  assert.ok(cookie, "successful authentication should set a session cookie");
  return cookie.split(";")[0];
}

test("email registration stores only a password hash and issues a normal session", async () => {
  const DB = createAuthDb();
  const response = await register({
    request: postJson("/api/auth/register", {
      email: "  New.User@example.test ",
      username: "New User",
      password,
    }),
    env: { ...envWithoutDb, DB },
  });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.authenticated, true);
  assert.match(data.user.id, /^local:/);
  assert.deepEqual(
    { username: data.user.username, avatar: data.user.avatar },
    { username: "New User", avatar: null },
  );
  const savedUser = DB.usersByEmail.get("new.user@example.test");
  assert.ok(savedUser);
  assert.equal(savedUser.id, data.user.id);
  assert.equal(savedUser.password_hash, DB.writes[0].values[4]);
  assert.notEqual(savedUser.password_hash, password);
  assert.equal("password" in savedUser, false);
  assert.equal(JSON.stringify(DB.writes).includes(password), false);
  assert.equal(await verifyPassword(password, savedUser.password_salt, savedUser.password_hash), true);

  const cookie = await cookieFrom(response);
  assert.deepEqual(
    await getSession(request("/api/auth/me", { cookie }), envWithoutDb),
    { user_id: data.user.id, username: "New User", avatar: null },
  );
  const meResponse = await me({
    request: request("/api/auth/me", { cookie }),
    env: envWithoutDb,
  });
  assert.equal(meResponse.status, 200);
  assert.deepEqual(await meResponse.json(), { authenticated: true, user: data.user });
});

test("email login validates the password and issues a standard session", async () => {
  const DB = createAuthDb();
  await register({
    request: postJson("/api/auth/register", {
      email: "login@example.test",
      username: "Login User",
      password,
    }),
    env: { ...envWithoutDb, DB },
  });

  const response = await login({
    request: postJson("/api/auth/login", { email: "LOGIN@example.test", password }),
    env: { ...envWithoutDb, DB },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.authenticated, true);
  assert.deepEqual(
    await getSession(request("/api/auth/me", { cookie: await cookieFrom(response) }), envWithoutDb),
    { user_id: data.user.id, username: "Login User", avatar: null },
  );

  const wrongPassword = await login({
    request: postJson("/api/auth/login", {
      email: "login@example.test",
      password: "this password is incorrect",
    }),
    env: { ...envWithoutDb, DB },
  });
  assert.equal(wrongPassword.status, 401);
});

test("email registration rejects invalid fields and duplicate addresses", async () => {
  const DB = createAuthDb();
  const invalidRegistrations = [
    { email: "not-an-email", username: "Valid Name", password },
    { email: "valid@example.test", username: "x", password },
    { email: "valid@example.test", username: "Valid Name", password: "short" },
  ];
  for (const body of invalidRegistrations) {
    const response = await register({
      request: postJson("/api/auth/register", body),
      env: { ...envWithoutDb, DB },
    });
    assert.equal(response.status, 400, JSON.stringify(body));
  }

  const valid = {
    email: "duplicate@example.test",
    username: "Duplicate User",
    password,
  };
  assert.equal((await register({
    request: postJson("/api/auth/register", valid),
    env: { ...envWithoutDb, DB },
  })).status, 201);
  assert.equal((await register({
    request: postJson("/api/auth/register", { ...valid, email: " DUPLICATE@example.test " }),
    env: { ...envWithoutDb, DB },
  })).status, 409);
  assert.equal(DB.usersByEmail.size, 1);
});

test("POST items requires a session and creates, validates, and conflicts correctly", async () => {
  const DB = createItemsDb();
  const env = { ...envWithoutDb, DB };
  const itemBody = {
    name: "Multímetro novo",
    category: "Ferramentas",
    description: "Instrumento de bancada",
    unit: "unidade",
    quantity: 3,
    min_quantity: 1,
    responsible_agent: "Equipe de laboratório",
  };

  const unauthorized = await items({
    request: postJson("/api/items", itemBody),
    env,
  });
  assert.equal(unauthorized.status, 401);

  const cookie = (await makeSessionCookie({
    user_id: "local:test-user",
    username: "Authenticated User",
    avatar: null,
  }, secret)).split(";")[0];

  const invalid = await items({
    request: postJson("/api/items", { ...itemBody, quantity: -1 }, cookie),
    env,
  });
  assert.equal(invalid.status, 400);
  assert.equal(DB.insertedItems.length, 0);

  const created = await items({
    request: postJson("/api/items", itemBody, cookie),
    env,
  });
  assert.equal(created.status, 201);
  const createdData = await created.json();
  assert.equal(createdData.item.id, 900, "ID should come from D1's last_row_id");
  assert.equal(createdData.item.responsible_agent, itemBody.responsible_agent);
  assert.equal(DB.insertedItems[0].responsible_agent, itemBody.responsible_agent);
  assert.equal(DB.insertedItems[0].id, 900);

  const duplicate = await items({
    request: postJson("/api/items", itemBody, cookie),
    env,
  });
  assert.equal(duplicate.status, 409);
});
