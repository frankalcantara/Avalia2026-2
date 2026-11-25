import test from "node:test";
import assert from "node:assert/strict";
import { createSignedSession, readSession } from "../functions/_shared/session.js";
import { onRequestPost as createQuestion } from "../functions/api/questions.js";
import { onRequestPost as createAnswer } from "../functions/api/questions/[questionId]/answers.js";
import { onRequestPut as acceptAnswer } from "../functions/api/questions/[questionId]/accepted-answer.js";
import { onRequestGet as startDiscordLogin } from "../functions/api/auth/discord.js";
import { onRequestGet as finishDiscordLogin } from "../functions/api/auth/discord/callback.js";

const TEST_SECRET = "unit-test-only-not-a-production-credential-32";

async function requestWithSession(user, body) {
  const session = await createSignedSession(user, TEST_SECRET);
  return new Request("http://127.0.0.1/api/test", {
    method: "POST",
    headers: {
      Cookie: `discord_session=${session}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function databaseWith(handler) {
  const queries = [];
  return {
    queries,
    prepare(sql) {
      return {
        bind(...values) {
          queries.push({ sql, values });
          return {
            first: () => handler(sql, values, "first"),
            run: () => handler(sql, values, "run"),
            all: () => handler(sql, values, "all"),
          };
        },
      };
    },
  };
}

test("signed sessions reject tampering and accept an intact payload", async () => {
  const user = { userId: "qa-user", username: "QA", avatar: null };
  const token = await createSignedSession(user, TEST_SECRET);
  const validRequest = new Request("http://127.0.0.1/", {
    headers: { Cookie: `discord_session=${token}` },
  });
  const tamperedRequest = new Request("http://127.0.0.1/", {
    headers: { Cookie: `discord_session=${token.slice(0, -1)}x` },
  });

  assert.deepEqual(await readSession(validRequest, TEST_SECRET), user);
  assert.equal(await readSession(tamperedRequest, TEST_SECRET), null);
});

test("question creation requires a session and derives its author from that session", async () => {
  const unusedDb = databaseWith(() => {
    throw new Error("Unauthenticated requests must not access D1.");
  });
  const unauthenticated = await createQuestion({
    request: new Request("http://localhost/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Question", content: "Details" }),
    }),
    env: { DB: unusedDb },
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unusedDb.queries.length, 0);

  const db = databaseWith((sql, values, method) => {
    if (method === "run" && sql.includes("INSERT INTO questions")) {
      return { meta: { last_row_id: 12 } };
    }
    if (method === "first" && sql.includes("FROM questions q")) {
      return {
        id: 12,
        title: "Question",
        content: "Details",
        authorUserId: "qa-owner",
        authorUsername: "Owner",
        authorAvatar: null,
        status: "open",
        acceptedAnswerId: null,
        answerCount: 0,
        createdAt: "2026-11-19 00:00:00",
      };
    }
    throw new Error(`Unexpected query: ${sql} (${values.join(",")})`);
  });
  const request = await requestWithSession(
    { userId: "qa-owner", username: "Owner", avatar: null },
    {
      title: "Question",
      content: "Details",
      userId: "forged-user",
      author_user_id: "forged-user",
    },
  );
  const response = await createQuestion({ request, env: { DB: db, SESSION_SECRET: TEST_SECRET } });
  const insert = db.queries.find(({ sql }) => sql.includes("INSERT INTO questions"));

  assert.equal(response.status, 201);
  assert.deepEqual(insert.values, ["qa-owner", "Question", "Details"]);
});

test("answer creation rejects unauthenticated requests", async () => {
  const response = await createAnswer({
    request: new Request("http://localhost/api/questions/2/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Answer" }),
    }),
    env: { DB: databaseWith(() => {
      throw new Error("Unauthenticated requests must not access D1.");
    }) },
    params: { questionId: "2" },
  });

  assert.equal(response.status, 401);
});

test("answer creation uses a conditional insert to reject resolved questions", async () => {
  const db = databaseWith((sql, values, method) => {
    if (method === "run") {
      assert.match(sql, /INSERT INTO answers[\s\S]*WHERE id = \? AND status = 'open'/);
      assert.deepEqual(values, [4, "qa-user", "Answer", 4]);
      return { meta: { changes: 0 } };
    }
    assert.match(sql, /SELECT id, status FROM questions/);
    return { id: 4, status: "resolved" };
  });
  const request = await requestWithSession(
    { userId: "qa-user", username: "QA", avatar: null },
    { content: "Answer" },
  );
  const response = await createAnswer({
    request,
    env: { DB: db, SESSION_SECRET: TEST_SECRET },
    params: { questionId: "4" },
  });

  assert.equal(response.status, 409);
});

test("only the question owner can accept an answer", async () => {
  const db = databaseWith((sql) => {
    assert.match(sql, /SELECT id, author_user_id AS authorUserId/);
    return { id: 4, authorUserId: "another-user", status: "open" };
  });
  const request = await requestWithSession(
    { userId: "qa-user", username: "QA", avatar: null },
    { answerId: 8 },
  );
  const response = await acceptAnswer({
    request,
    env: { DB: db, SESSION_SECRET: TEST_SECRET },
    params: { questionId: "4" },
  });

  assert.equal(response.status, 403);
  assert.equal(db.queries.length, 1);
});

test("accepting an answer requires a session", async () => {
  const db = databaseWith(() => {
    throw new Error("Unauthenticated requests must not access D1.");
  });
  const response = await acceptAnswer({
    request: new Request("http://localhost/api/questions/4/accepted-answer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerId: 9 }),
    }),
    env: { DB: db },
    params: { questionId: "4" },
  });

  assert.equal(response.status, 401);
  assert.equal(db.queries.length, 0);
});

test("an answer from another question cannot be accepted", async () => {
  const db = databaseWith((sql, values, method) => {
    assert.equal(method, "first");
    if (sql.includes("SELECT id, author_user_id AS authorUserId")) {
      return { id: 4, authorUserId: "qa-user", status: "open" };
    }
    assert.match(sql, /WHERE id = \? AND question_id = \?/);
    assert.deepEqual(values, [9, 4]);
    return null;
  });
  const request = await requestWithSession(
    { userId: "qa-user", username: "QA", avatar: null },
    { answerId: 9 },
  );
  const response = await acceptAnswer({
    request,
    env: { DB: db, SESSION_SECRET: TEST_SECRET },
    params: { questionId: "4" },
  });

  assert.equal(response.status, 404);
  assert.equal(db.queries.length, 2);
});

test("the question owner can atomically accept an answer from their own question", async () => {
  const db = databaseWith((sql, values, method) => {
    if (method === "first" && sql.includes("SELECT id, author_user_id AS authorUserId")) {
      return { id: 4, authorUserId: "qa-user", status: "open" };
    }
    if (method === "first" && sql.includes("SELECT id FROM answers")) {
      return { id: 9 };
    }
    if (method === "run") {
      assert.match(sql, /status = 'resolved'/);
      assert.deepEqual(values, [9, 4, "qa-user", 9]);
      return { meta: { changes: 1 } };
    }
    if (method === "first" && sql.includes("accepted_answer_id AS acceptedAnswerId")) {
      return { id: 4, status: "resolved", acceptedAnswerId: 9 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  const request = await requestWithSession(
    { userId: "qa-user", username: "QA", avatar: null },
    { answerId: 9 },
  );
  const response = await acceptAnswer({
    request,
    env: { DB: db, SESSION_SECRET: TEST_SECRET },
    params: { questionId: "4" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: 4,
    status: "resolved",
    acceptedAnswerId: 9,
  });
});

test("Discord login reports missing credentials instead of simulating a user", async () => {
  const response = await startDiscordLogin({
    request: new Request("http://127.0.0.1:8788/api/auth/discord"),
    env: {},
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "oauth_not_configured");
});

test("OAuth callback rejects requests without the matching state cookie", async () => {
  const response = await finishDiscordLogin({
    request: new Request("http://127.0.0.1:8788/api/auth/discord/callback?code=not-used&state=wrong"),
    env: {},
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/?auth_error=invalid_state");
  assert.match(response.headers.get("set-cookie"), /discord_oauth_state=;/);
});
