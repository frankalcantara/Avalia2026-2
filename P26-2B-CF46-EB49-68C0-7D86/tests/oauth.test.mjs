import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { onRequest } from "../functions/api/[[route]].js";
import { callbackPath, mockDiscord, oauthEnvironment, oauthMigration, prepareOAuthDatabase, startPath } from "./support/oauth.mjs";

import { migration, seedSession } from "./support/database.mjs";

const origin = "https://example.test";
const first = { id: "123456789012345670", username: "fixture-owner", global_name: "Titular OAuth QA", avatar: "0123456789abcdef0123456789abcdef" };
const second = { id: "123456789012345671", username: "fixture-other", global_name: null, avatar: null };
const cookie = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + "="));
const cookiePair = value => value?.split(";", 1)[0];
const hash = value => createHash("sha256").update(value).digest("hex");
const sessionName = "__Host-p23_session";
const oauthName = "__Host-p23_oauth";

function makeHarness(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  prepareOAuthDatabase(db);
  const env = oauthEnvironment(db, origin);
  const request = async (path, { method = "GET", browserCookie, body, options = env, base = origin } = {}) => {
    const headers = { Origin: base };
    if (browserCookie) headers.Cookie = browserCookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return onRequest({ request: new Request(base + path, { method, headers, body: JSON.stringify(body) }), env: options });
  };
  const begin = async () => {
    const response = await request(startPath);
    assert.equal(response.status, 302);
    const destination = new URL(response.headers.get("Location"));
    assert.equal(destination.origin, "https://discord.com");
    assert.equal(destination.pathname, "/oauth2/authorize");
    assert.equal(destination.searchParams.get("response_type"), "code");
    assert.equal(destination.searchParams.get("scope"), "identify");
    assert.equal(destination.searchParams.get("redirect_uri"), env.DISCORD_REDIRECT_URI);
    assert.equal(destination.searchParams.get("code_challenge_method"), "S256");
    const temporary = cookie(response, oauthName);
    assert.ok(temporary);
    for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(temporary.includes(attribute));
    assert.doesNotMatch(temporary, /;\s*Domain=/i);
    return { state: destination.searchParams.get("state"), challenge: destination.searchParams.get("code_challenge"), temporary };
  };
  const complete = (attempt, params = { code: "fixture-authorization-code" }, session) =>
    request(callbackPath + "?" + new URLSearchParams({ state: attempt.state, iss: "https://discord.com", ...params }), {
      browserCookie: [cookiePair(attempt.temporary), session].filter(Boolean).join("; "),
    });
  return { db, env, request, begin, complete };
}

test("OAuth Discord: identidade, PKCE, sessão, isolamento e revogação", async (t) => {
  const qa = makeHarness(t);
  let identity = first;
  const outbound = mockDiscord(t, () => identity);
  const attempt = await qa.begin();
  const authorized = await qa.complete(attempt);
  assert.equal(authorized.status, 303);
  assert.equal(authorized.headers.get("Location"), "/");
  const session = cookie(authorized, sessionName);
  assert.ok(session);
  for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(session.includes(attribute));
  assert.doesNotMatch(session, /;\s*Domain=/i);
  assert.match(cookie(authorized, oauthName), /Max-Age=0/i);
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity"]);
  const form = outbound[0].form;
  assert.equal(outbound[0].method, "POST");
  assert.equal(form.get("grant_type"), "authorization_code");
  assert.equal(form.get("redirect_uri"), qa.env.DISCORD_REDIRECT_URI);
  assert.equal(createHash("sha256").update(form.get("code_verifier")).digest("base64url"), attempt.challenge);

  let browserCookie = cookiePair(session);
  const token = browserCookie.slice(sessionName.length + 1);
  const persisted = qa.db.prepare("SELECT token_hash FROM sessions").get();
  assert.equal(persisted.token_hash, hash(token));
  const savedDiscordUser = qa.db.prepare("SELECT discord_username FROM users WHERE discord_id = ?").get(first.id);
  assert.equal(savedDiscordUser.discord_username, first.username);
  const data = await (await qa.request("/api/session", { browserCookie })).json();
  assert.equal(data.user.displayName, first.global_name);
  assert.match(data.user.avatarUrl, /^https:\/\/cdn\.discordapp\.com\/avatars\//);

  const saved = await qa.request("/api/projects", {
    browserCookie, method: "POST", body: { name: "Projeto OAuth QA", style: "abnt" },
  });
  assert.equal(saved.status, 201);
  const { project } = await saved.json();
  const replay = await qa.complete(attempt);
  assert.equal(replay.headers.get("Location"), "/?auth=invalid");
  assert.equal(cookie(replay, sessionName), undefined);
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity"]);

  identity = { ...first, username: "fixture-renamed", global_name: "Titular renomeada" };
  const reentry = await qa.complete(await qa.begin(), undefined, browserCookie);
  const rotated = cookiePair(cookie(reentry, sessionName));
  assert.ok(rotated && rotated !== browserCookie);
  assert.deepEqual(await (await qa.request("/api/session", { browserCookie })).json(), { user: null });
  browserCookie = rotated;
  const updated = await (await qa.request("/api/session", { browserCookie })).json();
  assert.equal(updated.user.id, data.user.id);
  assert.equal(updated.user.displayName, identity.global_name);
  assert.equal(qa.db.prepare("SELECT discord_username FROM users WHERE id = ?").get(updated.user.id).discord_username, identity.username);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM users").get().total, 1);
  assert.equal((await qa.request("/api/projects/" + project.id, { browserCookie })).status, 200);

  identity = second;
  const other = await qa.complete(await qa.begin());
  const otherCookie = cookiePair(cookie(other, sessionName));
  assert.ok(otherCookie);
  const otherProfile = await (await qa.request("/api/session", { browserCookie: otherCookie })).json();
  assert.equal(otherProfile.user.displayName, second.username);
  assert.match(otherProfile.user.avatarUrl, /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\//);
  assert.equal((await qa.request("/api/projects/" + project.id, { browserCookie: otherCookie })).status, 404);
  assert.equal((await qa.request("/api/auth/logout", { method: "POST", browserCookie })).status, 204);
  assert.equal((await qa.request("/api/projects", { browserCookie })).status, 401);
  qa.db.prepare("UPDATE sessions SET expires_at = 1").run();
  assert.deepEqual(await (await qa.request("/api/session", { browserCookie: otherCookie })).json(), { user: null });
});

test("callback rejeita cancelamento, estado expirado e ausência do cookie de vínculo", async (t) => {
  const qa = makeHarness(t);
  const outbound = mockDiscord(t, () => first);
  const cancelledAttempt = await qa.begin();
  const cancelled = await qa.complete(cancelledAttempt, { error: "access_denied" });
  assert.equal(cancelled.status, 303);
  assert.equal(cancelled.headers.get("Location"), "/?auth=cancelled");
  assert.equal(cookie(cancelled, sessionName), undefined);
  assert.equal((await qa.complete(cancelledAttempt)).headers.get("Location"), "/?auth=invalid");

  const unrelatedAttempt = await qa.begin();
  const noCookie = await qa.request(callbackPath + "?" + new URLSearchParams({
    state: unrelatedAttempt.state, code: "fixture-authorization-code",
  }));
  assert.equal(noCookie.headers.get("Location"), "/?auth=invalid");
  assert.equal(cookie(noCookie, sessionName), undefined);

  const expiredAttempt = await qa.begin();
  qa.db.prepare("UPDATE oauth_attempts SET expires_at = 1").run();
  const expired = await qa.complete(expiredAttempt);
  assert.equal(expired.headers.get("Location"), "/?auth=invalid");
  assert.equal(cookie(expired, sessionName), undefined);
  assert.deepEqual(outbound, []);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
});

test("falta de configuração e falha do Discord ficam sem sessão", async (t) => {
  const qa = makeHarness(t);
  const warning = t.mock.method(console, "warn", () => {});
  const outbound = mockDiscord(t, () => first, { tokenStatus: 503 });
  const disabled = [
    { options: { ...qa.env, DISCORD_CLIENT_SECRET: "" } },
    { options: { ...qa.env, DISCORD_REDIRECT_URI: "https://wrong.example.test" + callbackPath } },
    { base: "http://example.test" },
  ];
  for (const options of disabled) {
    const response = await qa.request(startPath, options);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/?auth=unavailable");
    assert.equal(cookie(response, oauthName), undefined);
  }
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM oauth_attempts").get().total, 0);
  const attempt = await qa.begin();
  const failure = await qa.complete(attempt);
  assert.equal(failure.status, 303);
  assert.equal(failure.headers.get("Location"), "/?auth=failed");
  assert.equal(cookie(failure, sessionName), undefined);
  assert.deepEqual(outbound.map(call => call.path), ["token"]);
  assertCallbackDiagnostic(warning, { stage: "token_exchange", httpStatus: 503 });
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
});

function assertCallbackDiagnostic(warning, detail) {
  assert.deepEqual(warning.mock.calls.map(call => call.arguments), [["discord_oauth_callback_failed", detail]]);
}

function assertCallbackFailure(response) {
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/?auth=failed");
  assert.match(cookie(response, oauthName), /Max-Age=0/i);
  assert.equal(cookie(response, sessionName), undefined);
}

test("troca do código registra somente status e erro OAuth permitido", async (t) => {
  const cases = [
    { status: 401, error: "invalid_client" },
    { status: 400, error: "invalid_grant" },
    { status: 400, error: "invalid_request" },
    { status: 502, error: "fixture-raw-provider-value", omitError: true },
    { status: 503, nonJson: true, omitError: true },
    { status: 302, redirect: true, omitError: true },
  ];

  for (const fixture of cases) {
    await t.test(fixture.error || (fixture.redirect ? "redirecionamento não seguido" : "resposta sem JSON"), async (t) => {
      const qa = makeHarness(t);
      const warning = t.mock.method(console, "warn", () => {});
      const provider = t.mock.method(globalThis, "fetch", async () => {
        if (fixture.redirect) return new Response(null, {
          status: fixture.status, headers: { Location: "https://redirect.example.test/fixture-private" },
        });
        if (fixture.nonJson) return new Response("fixture-raw-response", { status: fixture.status });
        return Response.json({
          error: fixture.error,
          error_description: "fixture-raw-provider-description",
          access_token: "fixture-raw-token",
        }, { status: fixture.status });
      });
      const attempt = await qa.begin();
      assertCallbackFailure(await qa.complete(attempt));
      assertCallbackDiagnostic(warning, {
        stage: "token_exchange",
        httpStatus: fixture.status ?? null,
        ...(fixture.omitError ? {} : { oauthError: fixture.error }),
      });

      assert.equal(provider.mock.callCount(), 1);
      const [url, request] = provider.mock.calls[0].arguments;
      assert.equal(String(url), "https://discord.com/api/oauth2/token");
      assert.equal(request.method, "POST");
      assert.equal(request.redirect, "manual");
      assert.equal(new Headers(request.headers).get("content-type"), "application/x-www-form-urlencoded");
      const verifier = request.body.get("code_verifier");
      assert.match(verifier, /^[A-Za-z0-9_-]{43}$/u);
      assert.equal(createHash("sha256").update(verifier).digest("base64url"), attempt.challenge);
      assert.deepEqual(Object.fromEntries(request.body), {
        client_id: qa.env.DISCORD_CLIENT_ID,
        client_secret: qa.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: qa.env.DISCORD_REDIRECT_URI,
        code: "fixture-authorization-code",
        code_verifier: verifier,
      });
      assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
      assert.equal((await qa.complete(attempt)).headers.get("Location"), "/?auth=invalid");
      assert.equal(provider.mock.callCount(), 1);
    });
  }
});

test("troca do código distingue preparação, fetch e timeout sem dados da exceção", async (t) => {
  const cases = [
    { category: "preparation", error: new ReferenceError("fixture-private-preparation") },
    { category: "fetch", error: new TypeError("fixture-private-fetch") },
    { category: "fetch", error: new DOMException("fixture-private-abort", "AbortError") },
    { category: "fetch", error: { name: "fixture-private-custom", message: "fixture-private-fetch" }, name: "UnknownError" },
    { category: "timeout", error: new DOMException("fixture-private-timeout", "TimeoutError") },
  ];
  for (const fixture of cases) {
    await t.test(fixture.category + ": " + (fixture.name || fixture.error.name), async (t) => {
      const qa = makeHarness(t);
      const warning = t.mock.method(console, "warn", () => {});
      const attempt = await qa.begin();
      const deadline = new AbortController();
      const timeout = t.mock.method(AbortSignal, "timeout", () => {
        if (fixture.category === "preparation") throw fixture.error;
        return deadline.signal;
      });
      const outbound = t.mock.method(globalThis, "fetch", async (_url, options) => {
        assert.equal(options.signal, deadline.signal);
        assert.equal(options.signal.aborted, false);
        if (fixture.category === "timeout") deadline.abort(fixture.error);
        throw fixture.error;
      });

      assertCallbackFailure(await qa.complete(attempt));
      assertCallbackDiagnostic(warning, {
        stage: "token_exchange",
        httpStatus: null,
        category: fixture.category,
        exceptionName: fixture.name || fixture.error.name,
      });
      assert.equal(timeout.mock.callCount(), 1);
      assert.equal(timeout.mock.calls[0].arguments[0], 8000);
      assert.equal(outbound.mock.callCount(), fixture.category === "preparation" ? 0 : 1);
      assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
      assert.equal((await qa.complete(attempt)).headers.get("Location"), "/?auth=invalid");
    });
  }
});
test("callback rejeita resposta de token sem credencial utilizável", async (t) => {
  const qa = makeHarness(t);
  const warning = t.mock.method(console, "warn", () => {});
  const discord = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ token_type: "Bearer", scope: "identify", extra: "fixture privada" }));

  assertCallbackFailure(await qa.complete(await qa.begin()));
  assertCallbackDiagnostic(warning, { stage: "token_response" });
  assert.equal(discord.mock.callCount(), 1);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
});

test("callback com state válido rejeita falha ao consultar o perfil Discord", async (t) => {
  const qa = makeHarness(t);
  const warning = t.mock.method(console, "warn", () => {});
  const outbound = mockDiscord(t, () => first, { profileStatus: 403 });
  const attempt = await qa.begin();

  assertCallbackFailure(await qa.complete(attempt));
  assertCallbackDiagnostic(warning, { stage: "profile_request", httpStatus: 403 });
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity"]);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
  assert.equal((await qa.complete(attempt)).headers.get("Location"), "/?auth=invalid");
});

test("callback com state válido rejeita perfil incompatível do Discord", async (t) => {
  const qa = makeHarness(t);
  const warning = t.mock.method(console, "warn", () => {});
  const outbound = mockDiscord(t, () => ({ ...first, id: null }));

  assertCallbackFailure(await qa.complete(await qa.begin()));
  assertCallbackDiagnostic(warning, { stage: "profile_response" });
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity"]);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM users").get().total, 0);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
});

test("callback com state válido recusa sessão se a escrita no D1 falhar", async (t) => {
  const warning = t.mock.method(console, "warn", () => {});
  const qa = makeHarness(t);
  const outbound = mockDiscord(t, () => first);
  const attempt = await qa.begin();
  qa.db.exec("CREATE TRIGGER reject_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'fixture D1 failure'); END");

  assertCallbackFailure(await qa.complete(attempt));
  assertCallbackDiagnostic(warning, { stage: "session_write" });
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity"]);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM users").get().total, 0);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
  assert.equal((await qa.complete(attempt)).headers.get("Location"), "/?auth=invalid");
});

test("callback recusa sessão se D1 concluir o lote sem criar uma linha", async (t) => {
  const qa = makeHarness(t);
  const warning = t.mock.method(console, "warn", () => {});
  const outbound = mockDiscord(t, () => first);
  const previousToken = seedSession(qa.db, "Sessão anterior");
  const previousSession = sessionName + "=" + previousToken;
  const attempt = await qa.begin();
  qa.db.exec("CREATE TRIGGER ignore_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(IGNORE); END");

  assertCallbackFailure(await qa.complete(attempt, undefined, previousSession));
  assertCallbackDiagnostic(warning, { stage: "session_write" });
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity"]);
  assert.equal(qa.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 1);
  const profile = await (await qa.request("/api/session", { browserCookie: previousSession })).json();
  assert.equal(profile.user.displayName, "Sessão anterior");
});

test("migração OAuth preserva uma sessão e um usuário preexistentes", async (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(migration);
  const priorToken = seedSession(db, "Conta anterior");
  db.exec(oauthMigration);
  assert.equal(db.prepare("SELECT discord_username FROM users").get().discord_username, null);
  const response = await onRequest({
    request: new Request(origin + "/api/session", { headers: { Cookie: sessionName + "=" + priorToken } }),
    env: oauthEnvironment(db, origin),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.displayName, "Conta anterior");
});
