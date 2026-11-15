import assert from "node:assert/strict";
import test from "node:test";
import {
  createRandomToken,
  getOAuthConfig,
  handleCurrentUser,
  handleDiscordLogin,
  handleDiscordCallback,
  handleLogout,
  readCookie,
  sha256Hex,
} from "../../functions/_shared/auth.js";

const appUrl = "https://soundroom.example";

function request(path, { method = "GET", headers = {} } = {}) {
  return new Request(`${appUrl}${path}`, { method, headers });
}

function sessionDb(user) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          calls.push({ sql, values: this.values, method: "first" });
          return user;
        },
        async run() {
          calls.push({ sql, values: this.values, method: "run" });
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

function callbackDb(stateHash) {
  const calls = [];
  let stateAvailable = true;
  const user = {
    id: "oauth-user",
    discord_id: "12345678901234567",
    display_name: "Conta Discord",
    avatar_hash: "avatar-hash",
  };
  return {
    calls,
    prepare(sql) {
      return {
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          calls.push({ sql, values: this.values, method: "first" });
          if (sql.includes("DELETE FROM oauth_states")) {
            if (!stateAvailable || this.values[0] !== stateHash) return null;
            stateAvailable = false;
            return { state_hash: stateHash };
          }
          if (sql.includes("INSERT INTO users")) return user;
          return null;
        },
        async run() {
          calls.push({ sql, values: this.values, method: "run" });
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

function callbackRequest({ state, code = "one-time-code", cookieState = state, error } = {}) {
  const query = new URLSearchParams();
  if (state !== undefined) query.append("state", state);
  if (code !== undefined) query.append("code", code);
  if (error !== undefined) query.append("error", error);
  return request(`/api/auth/callback?${query}`, {
    headers: { Cookie: `soundroom_oauth_state=${cookieState}` },
  });
}

const oauthEnv = {
  APP_URL: appUrl,
  DISCORD_CLIENT_ID: "test-client-id",
  DISCORD_CLIENT_SECRET: "test-client-secret",
  DISCORD_REDIRECT_URI: `${appUrl}/api/auth/callback`,
};

test("session helpers generate opaque tokens and SHA-256 hashes", async () => {
  const first = createRandomToken();
  const second = createRandomToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
  assert.equal(await sha256Hex("soundroom"), "6ea877dac16087738066f3f6ba41b562db5cac4bfe5b48df61f077c0ab665dc0");
});

test("cookie parser matches exact cookie names", () => {
  const req = request("/", {
    headers: { Cookie: "soundroom_session=first; soundroom_session_extra=second" },
  });

  assert.equal(readCookie(req, "soundroom_session"), "first");
  assert.equal(readCookie(req, "missing"), null);
});

test("production OAuth config requires HTTPS and a same-origin callback", () => {
  const config = getOAuthConfig({
    APP_URL: appUrl,
    DISCORD_CLIENT_ID: "client-id",
    DISCORD_CLIENT_SECRET: "server-only-secret",
    DISCORD_REDIRECT_URI: `${appUrl}/api/auth/callback`,
  });
  assert.equal(config.secureCookie, true);
  assert.equal(config.redirectUri, `${appUrl}/api/auth/callback`);

  assert.throws(() => getOAuthConfig({
    APP_URL: "http://soundroom.example",
    DISCORD_CLIENT_ID: "client-id",
    DISCORD_CLIENT_SECRET: "server-only-secret",
    DISCORD_REDIRECT_URI: "http://soundroom.example/api/auth/callback",
  }), /inválida/u);
  assert.throws(() => getOAuthConfig({
    APP_URL: appUrl,
    DISCORD_CLIENT_ID: "client-id",
    DISCORD_CLIENT_SECRET: "server-only-secret",
    DISCORD_REDIRECT_URI: "https://other.example/api/auth/callback",
  }), /mesma origem/u);
});

test("Discord login redirects with a hashed one-use state and a scoped HttpOnly cookie", async () => {
  const statements = [];
  const DB = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
      };
    },
    async batch(batchStatements) {
      statements.push(...batchStatements.map(({ sql, values }) => ({ sql, values })));
      return [];
    },
  };
  const response = await handleDiscordLogin({
    request: request("/api/auth/discord"),
    env: { ...oauthEnv, DB },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const authorizationUrl = new URL(response.headers.get("Location"));
  assert.equal(authorizationUrl.origin, "https://discord.com");
  assert.equal(authorizationUrl.pathname, "/oauth2/authorize");
  assert.equal(authorizationUrl.searchParams.get("client_id"), oauthEnv.DISCORD_CLIENT_ID);
  assert.equal(authorizationUrl.searchParams.get("redirect_uri"), oauthEnv.DISCORD_REDIRECT_URI);
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizationUrl.searchParams.get("scope"), "identify");

  const state = authorizationUrl.searchParams.get("state");
  assert.match(state, /^[A-Za-z0-9_-]{43}$/u);
  const stateCookie = response.headers.get("Set-Cookie");
  assert.ok(stateCookie.startsWith(`soundroom_oauth_state=${state};`));
  assert.match(stateCookie, /HttpOnly/u);
  assert.match(stateCookie, /SameSite=Lax/u);
  assert.match(stateCookie, /Path=\/api\/auth/u);
  assert.match(stateCookie, /Secure/u);
  assert.equal(statements.length, 3);
  assert.ok(statements[2].sql.includes("INSERT INTO oauth_states"));
  assert.equal(statements[2].values[0], await sha256Hex(state));
  assert.notEqual(statements[2].values[0], state);
});

test("GET /api/auth/me returns the authenticated user from its session", async () => {
  const token = "test-session-token";
  const user = {
    id: "user-1",
    discord_id: "12345678901234567",
    display_name: "Estudante",
    avatar_hash: null,
  };
  const DB = sessionDb(user);
  const response = await handleCurrentUser({
    request: request("/api/auth/me", { headers: { Cookie: `soundroom_session=${token}` } }),
    env: { DB },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    user: {
      id: user.id,
      discordId: user.discord_id,
      displayName: user.display_name,
      avatarUrl: null,
    },
  });
  assert.equal(DB.calls[0].values[0], await sha256Hex(token));
});

test("GET /api/auth/me returns null for an invalid session", async () => {
  const response = await handleCurrentUser({
    request: request("/api/auth/me", { headers: { Cookie: "soundroom_session=bad-token" } }),
    env: { DB: sessionDb(null) },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: null });
});

test("logout requires a same-origin request and revokes the hashed session", async () => {
  const DB = sessionDb(null);
  const token = "logout-session-token";
  const response = await handleLogout({
    request: request("/api/auth/logout", {
      method: "POST",
      headers: {
        Cookie: `soundroom_session=${token}`,
        Origin: appUrl,
        "Sec-Fetch-Site": "same-origin",
      },
    }),
    env: { APP_URL: appUrl, DB },
  });

  assert.equal(response.status, 204);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly/u);
  assert.match(response.headers.get("Set-Cookie"), /SameSite=Lax/u);
  assert.match(response.headers.get("Set-Cookie"), /Secure/u);
  assert.equal(DB.calls[0].values[0], await sha256Hex(token));

  const rejected = await handleLogout({
    request: request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    }),
    env: { APP_URL: appUrl, DB: sessionDb(null) },
  });
  assert.equal(rejected.status, 403);
});

test("Discord callback exchanges code, consumes state once, and creates a secure session", async () => {
  const state = createRandomToken();
  const stateHash = await sha256Hex(state);
  const DB = callbackDb(stateHash);
  const providerCalls = [];
  let profileAuthorization;
  const fetchImpl = async (url, options) => {
    providerCalls.push({ url: String(url), options });
    if (String(url).endsWith("/oauth2/token")) {
      const body = new URLSearchParams(options.body);
      assert.equal(body.get("client_id"), oauthEnv.DISCORD_CLIENT_ID);
      assert.equal(body.get("client_secret"), oauthEnv.DISCORD_CLIENT_SECRET);
      assert.equal(body.get("code"), "one-time-code");
      assert.equal(body.get("redirect_uri"), oauthEnv.DISCORD_REDIRECT_URI);
      return new Response(JSON.stringify({
        access_token: "local-mock-token-value",
        token_type: "Bearer",
        scope: "identify",
      }), { status: 200 });
    }

    profileAuthorization = options.headers.Authorization;
    return new Response(JSON.stringify({
      id: "12345678901234567",
      username: "discord-user",
      global_name: "Conta Discord",
      avatar: "avatar_hash",
    }), { status: 200 });
  };

  const response = await handleDiscordCallback({
    request: callbackRequest({ state }),
    env: { ...oauthEnv, DB },
  }, fetchImpl);

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), `${appUrl}/`);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(providerCalls.length, 2);
  assert.match(profileAuthorization, /^Bearer \S+$/u);
  assert.equal(DB.calls.filter((call) => call.sql.includes("DELETE FROM oauth_states")).length, 1);

  const setCookies = response.headers.getSetCookie();
  const sessionCookie = setCookies.find((value) => value.startsWith("soundroom_session="));
  const stateCookie = setCookies.find((value) => value.startsWith("soundroom_oauth_state="));
  assert.ok(sessionCookie);
  assert.match(sessionCookie, /HttpOnly/u);
  assert.match(sessionCookie, /SameSite=Lax/u);
  assert.match(sessionCookie, /Secure/u);
  assert.match(sessionCookie, /Path=\//u);
  assert.match(stateCookie, /Max-Age=0/u);
  assert.match(stateCookie, /HttpOnly/u);

  const sessionToken = sessionCookie.match(/^soundroom_session=([A-Za-z0-9_-]+);/u)?.[1];
  assert.ok(sessionToken);
  const sessionInsert = DB.calls.find((call) => call.sql.includes("INSERT INTO sessions"));
  assert.ok(sessionInsert);
  assert.equal(sessionInsert.values[0], await sha256Hex(sessionToken));
  assert.equal(sessionInsert.values[1], "oauth-user");
  assert.equal(await sha256Hex(sessionToken), sessionInsert.values[0]);
  assert.ok(!response.headers.get("Location").includes("access-token"));

  const replay = await handleDiscordCallback({
    request: callbackRequest({ state }),
    env: { ...oauthEnv, DB },
  }, fetchImpl);
  assert.equal(replay.status, 303);
  assert.equal(new URL(replay.headers.get("Location")).searchParams.get("auth_error"), "state");
  assert.equal(providerCalls.length, 2);
  assert.equal(DB.calls.filter((call) => call.sql.includes("INSERT INTO sessions")).length, 1);
});

test("Discord callback rejects missing, mismatched, and repeated state before provider calls", async () => {
  const state = createRandomToken();
  const DB = callbackDb(await sha256Hex(state));
  let providerCalls = 0;
  const fetchImpl = async () => {
    providerCalls += 1;
    return new Response("{}");
  };

  for (const requestValue of [
    callbackRequest({ state: undefined }),
    callbackRequest({ state, cookieState: createRandomToken() }),
    request(`/api/auth/callback?state=${state}&state=${state}&code=one-time-code`, {
      headers: { Cookie: `soundroom_oauth_state=${state}` },
    }),
  ]) {
    const response = await handleDiscordCallback({
      request: requestValue,
      env: { ...oauthEnv, DB },
    }, fetchImpl);
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("auth_error"), "state");
  }
  assert.equal(providerCalls, 0);
  assert.equal(DB.calls.length, 0);
});

test("Discord callback handles provider denial, token failures, and invalid profiles", async () => {
  const makeContext = async (params) => {
    const state = createRandomToken();
    return {
      state,
      context: {
        request: callbackRequest({ state, ...params }),
        env: { ...oauthEnv, DB: callbackDb(await sha256Hex(state)) },
      },
    };
  };
  const authError = (response) => new URL(response.headers.get("Location")).searchParams.get("auth_error");

  const denied = await makeContext({ code: undefined, error: "access_denied" });
  const deniedResponse = await handleDiscordCallback(denied.context, async () => {
    assert.fail("A user denial must not call the provider.");
  });
  assert.equal(authError(deniedResponse), "denied");

  const tokenFailure = await makeContext({});
  const tokenFailureResponse = await handleDiscordCallback(
    tokenFailure.context,
    async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
  );
  assert.equal(authError(tokenFailureResponse), "oauth");

  const invalidProfile = await makeContext({});
  let requestCount = 0;
  const invalidProfileResponse = await handleDiscordCallback(invalidProfile.context, async () => {
    requestCount += 1;
    return requestCount === 1
      ? new Response(JSON.stringify({
      access_token: "local-mock-token-value",
        token_type: "Bearer",
        scope: "identify",
      }), { status: 200 })
      : new Response(JSON.stringify({ id: "bad-id", username: "not-valid" }), { status: 200 });
  });
  assert.equal(authError(invalidProfileResponse), "profile");
  assert.equal(requestCount, 2);
});
