#!/usr/bin/env node
/**
 * Suíte Automatizada de Testes, Segurança e Auditoria — Projeto #30 (CodeJukebox)
 * Chave Única: P26-2B-0018-0402-94DD-FCB7
 *
 * Zero dependências externas: utiliza exclusivamente node:test, node:assert/strict,
 * node:sqlite (DatabaseSync em memória), node:fs, node:path, node:url e node:child_process.
 * Executa a migração real migrations/0001_init.sql através de um adaptador fiel à API do Cloudflare D1.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

import { onRequestGet as statusGet } from "../functions/api/status.js";
import { onRequestGet as discordAuthGet } from "../functions/api/auth/discord.js";
import { onRequestGet as discordCallbackGet } from "../functions/api/auth/discord/callback.js";
import { onRequestGet as authMeGet } from "../functions/api/auth/me.js";
import { onRequestPost as authLogoutPost } from "../functions/api/auth/logout.js";
import {
  onRequestGet as roomsGet,
  onRequestPost as roomsPost,
} from "../functions/api/rooms/index.js";
import {
  onRequestGet as roomDetailGet,
  onRequestDelete as roomDetailDelete,
} from "../functions/api/rooms/[id]/index.js";
import { onRequestPost as roomTracksPost } from "../functions/api/rooms/[id]/tracks.js";
import { onRequestDelete as trackDelete } from "../functions/api/tracks/[id]/index.js";
import { onRequestPost as trackVotePost } from "../functions/api/tracks/[id]/vote.js";
import {
  validateRoomInput,
  validateTrackInput,
  validateTrackUrl,
  validateVoteValue,
} from "../src/server/validators.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MIGRATION_PATH = path.join(PROJECT_ROOT, "migrations", "0001_init.sql");
const MIGRATION_SQL = fs.readFileSync(MIGRATION_PATH, "utf8");

const PROJECT_KEY = "P26-2B-0018-0402-94DD-FCB7";
const ORIGIN = "https://p26-2b-0018-0402-94dd-fcb7.pages.dev";

/* ============================================================================
 * Adaptador Fiel ao Cloudflare D1 sobre node:sqlite (DatabaseSync em memória)
 * ============================================================================ */

function createD1Database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(MIGRATION_SQL);

  function makeStatement(sql, boundArgs = []) {
    return {
      _sql: sql,
      _args: boundArgs,
      bind(...args) {
        return makeStatement(sql, args);
      },
      async first(colName) {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundArgs);
        if (!row) return null;
        const plain = { ...row };
        if (colName !== undefined) {
          return Object.prototype.hasOwnProperty.call(plain, colName)
            ? plain[colName]
            : null;
        }
        return plain;
      },
      async all() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundArgs).map((r) => ({ ...r }));
        return {
          results: rows,
          success: true,
          meta: {
            changes: 0,
            last_row_id: 0,
          },
        };
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...boundArgs);
        return {
          results: [],
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      async raw() {
        const stmt = sqlite.prepare(sql);
        return stmt.all(...boundArgs).map((r) => Object.values(r));
      },
    };
  }

  return {
    sqlite,
    prepare(sql) {
      return makeStatement(sql, []);
    },
    async batch(statements) {
      const results = [];
      sqlite.exec("BEGIN");
      try {
        for (const stmt of statements) {
          const head = stmt._sql.trim().toUpperCase();
          const prepared = sqlite.prepare(stmt._sql);
          if (
            head.startsWith("SELECT") ||
            head.startsWith("PRAGMA") ||
            head.startsWith("WITH")
          ) {
            const rows = prepared.all(...stmt._args).map((r) => ({ ...r }));
            results.push({
              results: rows,
              success: true,
              meta: { changes: 0, last_row_id: 0 },
            });
          } else {
            const info = prepared.run(...stmt._args);
            results.push({
              results: [],
              success: true,
              meta: {
                changes: Number(info.changes ?? 0),
                last_row_id: Number(info.lastInsertRowid ?? 0),
              },
            });
          }
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (err) {
        try {
          sqlite.exec("ROLLBACK");
        } catch {
          // Ignora se nenhuma transação estiver ativa
        }
        throw err;
      }
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    close() {
      sqlite.close();
    },
  };
}

function createTestEnv(overrides = {}) {
  const db = createD1Database();
  const env = {
    DB: db,
    DISCORD_CLIENT_ID: "test-discord-client-id-123",
    DISCORD_CLIENT_SECRET: "test-discord-client-secret-xyz",
    ...overrides,
  };
  return { db, env };
}

function makeRequest(pathname, { method = "GET", headers = {}, body, cookie } = {}) {
  const finalHeaders = new Headers(headers);
  if (cookie) {
    finalHeaders.set("Cookie", cookie);
  }
  const init = { method, headers: finalHeaders };
  if (body !== undefined) {
    if (typeof body === "string") {
      init.body = body;
      if (!finalHeaders.has("Content-Type")) {
        finalHeaders.set("Content-Type", "application/json");
      }
    } else {
      init.body = JSON.stringify(body);
      finalHeaders.set("Content-Type", "application/json");
    }
  }
  return new Request(new URL(pathname, ORIGIN).href, init);
}

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function extractCookiePair(setCookies, cookieName) {
  for (const header of setCookies) {
    const firstPart = header.split(";")[0].trim();
    if (firstPart.startsWith(`${cookieName}=`)) {
      return firstPart;
    }
  }
  return null;
}

function seedAuthenticatedUser(
  db,
  {
    user_id,
    username,
    avatar = null,
    token = `sess_${user_id}_${Math.random().toString(16).slice(2)}`,
    expiresAt = new Date(Date.now() + 3600_000).toISOString(),
  }
) {
  db.sqlite
    .prepare(
      `INSERT INTO discord_users (user_id, username, avatar)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar`
    )
    .run(user_id, username, avatar);

  db.sqlite
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, user_id, expiresAt);

  return {
    user_id,
    username,
    avatar,
    token,
    cookie: `jukebox_session=${token}`,
  };
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Resposta não é JSON válido (HTTP ${response.status}): ${text}`);
  }
}

function listProjectFilesRecursive(dir, baseDir = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".wrangler") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listProjectFilesRecursive(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full).replace(/\\/g, "/"));
    }
  }
  return results;
}

/* ============================================================================
 * 1. Status e Saúde (GET /api/status)
 * ============================================================================ */

describe("1. Status e Saúde (GET /api/status)", () => {
  test("retorna d1Connected=true, chave oficial, projectId=30 e contagens iniciais zeradas", async () => {
    const { db, env } = createTestEnv();
    try {
      const res = await statusGet({ request: makeRequest("/api/status"), env });
      assert.equal(res.status, 200);
      const data = await readJson(res);

      assert.equal(data.ok, true);
      assert.equal(data.chave, PROJECT_KEY);
      assert.equal(data.projectId, 30);
      assert.equal(data.d1Connected, true);
      assert.equal(data.discordOAuthConfigured, true);
      assert.equal(data.sessionUser, null);
      assert.deepEqual(data.stats, { rooms: 0, tracks: 0, votes: 0 });
      assert.equal(typeof data.serverTimestamp, "string");
    } finally {
      db.close();
    }
  });

  test("retorna d1Connected=false quando env.DB está ausente", async () => {
    const res = await statusGet({
      request: makeRequest("/api/status"),
      env: {},
    });
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.equal(data.ok, true);
    assert.equal(data.d1Connected, false);
    assert.equal(data.discordOAuthConfigured, false);
    assert.equal(data.sessionUser, null);
  });

  test("reflete contagens reais de salas, faixas, votos e sessionUser autenticado", async () => {
    const { db, env } = createTestEnv();
    try {
      const alice = seedAuthenticatedUser(db, {
        user_id: "1001",
        username: "AliceDev",
        avatar: "https://cdn.discordapp.com/avatars/1001/abc.png",
      });

      const roomRes = await roomsPost({
        request: makeRequest("/api/rooms", {
          method: "POST",
          cookie: alice.cookie,
          body: { name: "Synthwave Noturno", theme_tag: "Synthwave" },
        }),
        env,
      });
      assert.equal(roomRes.status, 201);
      const { room } = await readJson(roomRes);

      const trackRes = await roomTracksPost({
        request: makeRequest(`/api/rooms/${room.id}/tracks`, {
          method: "POST",
          cookie: alice.cookie,
          body: {
            title: "Nightcall",
            artist: "Kavinsky",
            genre: "Synthwave",
            url: "https://www.youtube.com/watch?v=MV_3Dpw-BRY",
          },
        }),
        env,
        params: { id: String(room.id) },
      });
      assert.equal(trackRes.status, 201);
      const { track } = await readJson(trackRes);

      const voteRes = await trackVotePost({
        request: makeRequest(`/api/tracks/${track.id}/vote`, {
          method: "POST",
          cookie: alice.cookie,
          body: { value: 1 },
        }),
        env,
        params: { id: String(track.id) },
      });
      assert.equal(voteRes.status, 200);

      const statusRes = await statusGet({
        request: makeRequest("/api/status", { cookie: alice.cookie }),
        env,
      });
      const statusData = await readJson(statusRes);

      assert.equal(statusData.d1Connected, true);
      assert.deepEqual(statusData.stats, { rooms: 1, tracks: 1, votes: 1 });
      assert.deepEqual(statusData.sessionUser, {
        user_id: "1001",
        username: "AliceDev",
        avatar: "https://cdn.discordapp.com/avatars/1001/abc.png",
      });
    } finally {
      db.close();
    }
  });
});

/* ============================================================================
 * 2. Fluxo Discord OAuth2 Completo
 * ============================================================================ */

describe("2. Fluxo Discord OAuth2 Completo (/api/auth/*)", () => {
  test("GET /api/auth/discord redireciona para o Discord com state e cookie HttpOnly", async () => {
    const { db, env } = createTestEnv();
    try {
      const res = await discordAuthGet({
        request: makeRequest("/api/auth/discord"),
        env,
      });

      assert.equal(res.status, 302);
      const location = res.headers.get("Location");
      assert.ok(location, "Header Location obrigatório");

      const authUrl = new URL(location);
      assert.equal(authUrl.origin, "https://discord.com");
      assert.equal(authUrl.pathname, "/api/oauth2/authorize");
      assert.equal(authUrl.searchParams.get("client_id"), env.DISCORD_CLIENT_ID);
      assert.equal(
        authUrl.searchParams.get("redirect_uri"),
        `${ORIGIN}/api/auth/discord/callback`
      );
      assert.equal(authUrl.searchParams.get("response_type"), "code");
      assert.equal(authUrl.searchParams.get("scope"), "identify");

      const stateParam = authUrl.searchParams.get("state");
      assert.ok(stateParam && stateParam.length >= 32, "state CSRF deve ter entropia suficiente");

      const setCookies = getSetCookies(res);
      const stateCookieHeader = setCookies.find((c) =>
        c.startsWith("discord_oauth_state=")
      );
      assert.ok(stateCookieHeader, "Deve emitir cookie discord_oauth_state");
      assert.match(stateCookieHeader, /HttpOnly/i);
      assert.match(stateCookieHeader, /SameSite=Lax/i);
      assert.match(stateCookieHeader, /Path=\//i);
      assert.match(stateCookieHeader, /Secure/i);
      assert.equal(
        extractCookiePair(setCookies, "discord_oauth_state"),
        `discord_oauth_state=${stateParam}`
      );
    } finally {
      db.close();
    }
  });

  test("GET /api/auth/discord sem DISCORD_CLIENT_ID redireciona com oauth_not_configured (ou 503 em JSON)", async () => {
    const { db } = createTestEnv();
    try {
      const htmlRes = await discordAuthGet({
        request: makeRequest("/api/auth/discord"),
        env: { DB: db },
      });
      assert.equal(htmlRes.status, 302);
      assert.equal(htmlRes.headers.get("Location"), "/?auth_error=oauth_not_configured");

      const jsonRes = await discordAuthGet({
        request: makeRequest("/api/auth/discord", {
          headers: { Accept: "application/json" },
        }),
        env: { DB: db },
      });
      assert.equal(jsonRes.status, 503);
      const body = await readJson(jsonRes);
      assert.equal(body.ok, false);
      assert.equal(body.code, "OAUTH_NOT_CONFIGURED");
    } finally {
      db.close();
    }
  });

  test("GET /api/auth/discord/callback rejeita state ausente, cookie ausente ou state divergente (CSRF)", async () => {
    const { db, env } = createTestEnv();
    try {
      // 1. Sem state na query
      const resNoState = await discordCallbackGet({
        request: makeRequest("/api/auth/discord/callback?code=abc", {
          cookie: "discord_oauth_state=expected-state",
        }),
        env,
      });
      assert.equal(resNoState.status, 302);
      assert.equal(resNoState.headers.get("Location"), "/?auth_error=invalid_state");

      // 2. Sem cookie discord_oauth_state
      const resNoCookie = await discordCallbackGet({
        request: makeRequest("/api/auth/discord/callback?code=abc&state=some-state"),
        env,
      });
      assert.equal(resNoCookie.status, 302);
      assert.equal(resNoCookie.headers.get("Location"), "/?auth_error=invalid_state");

      // 3. State divergente (tentativa de CSRF)
      const resMismatch = await discordCallbackGet({
        request: makeRequest("/api/auth/discord/callback?code=abc&state=forged-state", {
          cookie: "discord_oauth_state=real-state",
        }),
        env,
      });
      assert.equal(resMismatch.status, 302);
      assert.equal(resMismatch.headers.get("Location"), "/?auth_error=invalid_state");
      const cleared = getSetCookies(resMismatch).find((c) =>
        c.startsWith("discord_oauth_state=")
      );
      assert.ok(cleared && /Max-Age=0/i.test(cleared), "Deve limpar cookie de state");

      // 4. Usuário cancelou no Discord (?error=access_denied)
      const resDenied = await discordCallbackGet({
        request: makeRequest("/api/auth/discord/callback?error=access_denied"),
        env,
      });
      assert.equal(resDenied.status, 302);
      assert.equal(resDenied.headers.get("Location"), "/?auth_error=access_denied");
    } finally {
      db.close();
    }
  });

  test("fluxo completo: /api/auth/discord -> callback (stub fetch) -> D1 -> /api/auth/me -> /api/auth/logout", async (t) => {
    const { db, env } = createTestEnv();
    const originalFetch = globalThis.fetch;
    const fetchCalls = [];

    t.after(() => {
      globalThis.fetch = originalFetch;
      db.close();
    });

    globalThis.fetch = async (input, init = {}) => {
      const targetUrl = typeof input === "string" ? input : input.url;
      fetchCalls.push({ url: targetUrl, init });

      if (targetUrl === "https://discord.com/api/oauth2/token") {
        assert.equal(init.method, "POST");
        const params = new URLSearchParams(init.body?.toString() || "");
        assert.equal(params.get("client_id"), env.DISCORD_CLIENT_ID);
        assert.equal(params.get("client_secret"), env.DISCORD_CLIENT_SECRET);
        assert.equal(params.get("grant_type"), "authorization_code");
        assert.equal(params.get("code"), "valid-discord-code-999");
        assert.equal(params.get("redirect_uri"), `${ORIGIN}/api/auth/discord/callback`);

        return new Response(
          JSON.stringify({
            access_token: "mock-discord-access-token",
            token_type: "Bearer",
            expires_in: 604800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (targetUrl === "https://discord.com/api/users/@me") {
        const authHeader = new Headers(init.headers).get("Authorization");
        assert.equal(authHeader, "Bearer mock-discord-access-token");

        return new Response(
          JSON.stringify({
            id: "987654321098765432",
            username: "joaodev",
            global_name: "João Dev",
            avatar: "a_hash123456",
            discriminator: "0",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Chamada fetch inesperada no teste OAuth2: ${targetUrl}`);
    };

    // Passo 1: Iniciar OAuth2
    const initRes = await discordAuthGet({
      request: makeRequest("/api/auth/discord"),
      env,
    });
    assert.equal(initRes.status, 302);
    const authorizeUrl = new URL(initRes.headers.get("Location"));
    const state = authorizeUrl.searchParams.get("state");
    const stateCookie = extractCookiePair(getSetCookies(initRes), "discord_oauth_state");

    // Passo 2: Callback com code + state válidos
    const cbRes = await discordCallbackGet({
      request: makeRequest(
        `/api/auth/discord/callback?code=valid-discord-code-999&state=${encodeURIComponent(state)}`,
        { cookie: stateCookie }
      ),
      env,
    });

    assert.equal(cbRes.status, 302);
    assert.equal(cbRes.headers.get("Location"), "/?login=success");
    assert.equal(fetchCalls.length, 2);

    const cbCookies = getSetCookies(cbRes);
    const sessionHeader = cbCookies.find((c) => c.startsWith("jukebox_session="));
    const clearedStateHeader = cbCookies.find((c) =>
      c.startsWith("discord_oauth_state=")
    );

    assert.ok(sessionHeader, "Deve emitir cookie jukebox_session");
    assert.match(sessionHeader, /HttpOnly/i);
    assert.match(sessionHeader, /SameSite=Lax/i);
    assert.match(sessionHeader, /Path=\//i);
    assert.match(sessionHeader, /Secure/i);
    assert.ok(clearedStateHeader && /Max-Age=0/i.test(clearedStateHeader));

    const sessionCookie = extractCookiePair(cbCookies, "jukebox_session");
    const sessionToken = sessionCookie.split("=")[1];
    assert.ok(sessionToken.length >= 64, "Token de sessão deve ter 32 bytes em hex");

    // Verificar persistência direta no SQLite/D1
    const dbUser = db.sqlite
      .prepare("SELECT user_id, username, avatar FROM discord_users WHERE user_id = ?")
      .get("987654321098765432");
    assert.deepEqual(
      { ...dbUser },
      {
        user_id: "987654321098765432",
        username: "João Dev",
        avatar: "https://cdn.discordapp.com/avatars/987654321098765432/a_hash123456.png",
      }
    );

    const dbSession = db.sqlite
      .prepare("SELECT token, user_id, expires_at FROM sessions WHERE token = ?")
      .get(sessionToken);
    assert.ok(dbSession, "Sessão deve existir na tabela sessions");
    assert.equal(dbSession.user_id, "987654321098765432");

    // Passo 3: GET /api/auth/me autenticado
    const meAuthRes = await authMeGet({
      request: makeRequest("/api/auth/me", { cookie: sessionCookie }),
      env,
    });
    assert.equal(meAuthRes.status, 200);
    const meAuthData = await readJson(meAuthRes);
    assert.equal(meAuthData.authenticated, true);
    assert.deepEqual(meAuthData.user, {
      user_id: "987654321098765432",
      username: "João Dev",
      avatar: "https://cdn.discordapp.com/avatars/987654321098765432/a_hash123456.png",
    });

    // Passo 4: POST /api/auth/logout revoga sessão no D1 e limpa cookie
    const logoutRes = await authLogoutPost({
      request: makeRequest("/api/auth/logout", {
        method: "POST",
        cookie: sessionCookie,
      }),
      env,
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookie = getSetCookies(logoutRes).find((c) =>
      c.startsWith("jukebox_session=")
    );
    assert.ok(logoutCookie && /Max-Age=0/i.test(logoutCookie));

    const remainingSession = db.sqlite
      .prepare("SELECT token FROM sessions WHERE token = ?")
      .get(sessionToken);
    assert.equal(remainingSession, undefined, "Sessão deve ser deletada do D1 após logout");

    // Passo 5: GET /api/auth/me com o cookie revogado retorna não autenticado
    const meAfterLogout = await authMeGet({
      request: makeRequest("/api/auth/me", { cookie: sessionCookie }),
      env,
    });
    const meAfterData = await readJson(meAfterLogout);
    assert.equal(meAfterData.authenticated, false);
    assert.equal(meAfterData.user, null);
  });

  test("GET /api/auth/me diferencia não autenticado, cookie forjado e sessão expirada (removendo a expirada)", async () => {
    const { db, env } = createTestEnv();
    try {
      // Não autenticado
      const anonRes = await authMeGet({
        request: makeRequest("/api/auth/me"),
        env,
      });
      const anonData = await readJson(anonRes);
      assert.equal(anonData.authenticated, false);
      assert.equal(anonData.user, null);

      // Cookie forjado
      const forgedRes = await authMeGet({
        request: makeRequest("/api/auth/me", {
          cookie: "jukebox_session=0000forgedtoken9999",
        }),
        env,
      });
      const forgedData = await readJson(forgedRes);
      assert.equal(forgedData.authenticated, false);
      assert.equal(forgedData.user, null);

      // Sessão expirada
      const expired = seedAuthenticatedUser(db, {
        user_id: "5555",
        username: "ExpiredUser",
        token: "expired_session_token_abc",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });

      const expRes = await authMeGet({
        request: makeRequest("/api/auth/me", { cookie: expired.cookie }),
        env,
      });
      const expData = await readJson(expRes);
      assert.equal(expData.authenticated, false);
      assert.equal(expData.user, null);

      // Confirma limpeza da sessão expirada no banco
      const row = db.sqlite
        .prepare("SELECT token FROM sessions WHERE token = ?")
        .get(expired.token);
      assert.equal(row, undefined, "Sessão expirada deve ser expurgada do D1");
    } finally {
      db.close();
    }
  });

  test("callback trata falhas da API do Discord (token_exchange_failed e fetch_user_failed)", async (t) => {
    const { db, env } = createTestEnv();
    const originalFetch = globalThis.fetch;

    t.after(() => {
      globalThis.fetch = originalFetch;
      db.close();
    });

    // Cenário 1: token endpoint retorna 400
    globalThis.fetch = async () => new Response("invalid_grant", { status: 400 });
    const resTokenFail = await discordCallbackGet({
      request: makeRequest("/api/auth/discord/callback?code=bad&state=st1", {
        cookie: "discord_oauth_state=st1",
      }),
      env,
    });
    assert.equal(resTokenFail.status, 302);
    assert.equal(
      resTokenFail.headers.get("Location"),
      "/?auth_error=token_exchange_failed"
    );

    // Cenário 2: token ok, mas /users/@me retorna 401
    globalThis.fetch = async (url) => {
      if (String(url).includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
      }
      return new Response("Unauthorized", { status: 401 });
    };
    const resUserFail = await discordCallbackGet({
      request: makeRequest("/api/auth/discord/callback?code=ok&state=st2", {
        cookie: "discord_oauth_state=st2",
      }),
      env,
    });
    assert.equal(resUserFail.status, 302);
    assert.equal(
      resUserFail.headers.get("Location"),
      "/?auth_error=fetch_user_failed"
    );
  });
});

/* ============================================================================
 * 3. Anti-Manipulação & Segurança na Borda (401, 403, 400, 409, SQLi, URLs)
 * ============================================================================ */

describe("3. Anti-Manipulação & Segurança na Borda", () => {
  test("retorna 401 em todas as rotas de escrita sem sessão, com cookie forjado ou sessão expirada", async () => {
    const { db, env } = createTestEnv();
    try {
      const owner = seedAuthenticatedUser(db, {
        user_id: "2001",
        username: "Owner",
      });
      const expired = seedAuthenticatedUser(db, {
        user_id: "2002",
        username: "Expired",
        expiresAt: new Date(Date.now() - 10_000).toISOString(),
      });

      // Cria sala e faixa legítimas para testar endpoints com :id real
      const { room } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: owner.cookie,
            body: { name: "Sala Protegida", theme_tag: "Rock Clássico" },
          }),
          env,
        })
      );

      const { track } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: owner.cookie,
            body: {
              title: "Bohemian Rhapsody",
              genre: "Rock Clássico",
              url: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      const invalidCookies = [
        undefined,
        "jukebox_session=forged-token-12345",
        expired.cookie,
      ];

      for (const badCookie of invalidCookies) {
        const r1 = await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: badCookie,
            body: { name: "Sala Invasora" },
          }),
          env,
        });
        assert.equal(r1.status, 401);

        const r2 = await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: badCookie,
            body: {
              title: "Hack Track",
              genre: "Indie",
              url: "https://youtu.be/dQw4w9WgXcQ",
            },
          }),
          env,
          params: { id: String(room.id) },
        });
        assert.equal(r2.status, 401);

        const r3 = await trackVotePost({
          request: makeRequest(`/api/tracks/${track.id}/vote`, {
            method: "POST",
            cookie: badCookie,
            body: { value: 1 },
          }),
          env,
          params: { id: String(track.id) },
        });
        assert.equal(r3.status, 401);

        const r4 = await trackDelete({
          request: makeRequest(`/api/tracks/${track.id}`, {
            method: "DELETE",
            cookie: badCookie,
          }),
          env,
          params: { id: String(track.id) },
        });
        assert.equal(r4.status, 401);

        const r5 = await roomDetailDelete({
          request: makeRequest(`/api/rooms/${room.id}`, {
            method: "DELETE",
            cookie: badCookie,
          }),
          env,
          params: { id: String(room.id) },
        });
        assert.equal(r5.status, 401);
      }
    } finally {
      db.close();
    }
  });

  test("ignora user_id / created_by / submitted_by forjados no body (identidade vem exclusivamente da sessão D1)", async () => {
    const { db, env } = createTestEnv();
    try {
      const realUser = seedAuthenticatedUser(db, {
        user_id: "3001",
        username: "UsuarioReal",
      });
      seedAuthenticatedUser(db, {
        user_id: "9999",
        username: "AdminVitima",
      });

      // Tenta forjar created_by / user_id ao criar sala
      const roomRes = await roomsPost({
        request: makeRequest("/api/rooms", {
          method: "POST",
          cookie: realUser.cookie,
          body: {
            name: "Sala Anti-Spoofing",
            theme_tag: "Lo-Fi",
            user_id: "9999",
            created_by: "9999",
            username: "AdminVitima",
          },
        }),
        env,
      });
      assert.equal(roomRes.status, 201);
      const { room } = await readJson(roomRes);
      assert.equal(room.created_by, "3001");
      assert.equal(room.creator_username, "UsuarioReal");

      // Tenta forjar submitted_by / user_id ao submeter faixa
      const trackRes = await roomTracksPost({
        request: makeRequest(`/api/rooms/${room.id}/tracks`, {
          method: "POST",
          cookie: realUser.cookie,
          body: {
            title: "Lofi Beats",
            genre: "Lo-Fi",
            url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
            user_id: "9999",
            submitted_by: "9999",
          },
        }),
        env,
        params: { id: String(room.id) },
      });
      assert.equal(trackRes.status, 201);
      const { track } = await readJson(trackRes);
      assert.equal(track.submitted_by, "3001");
      assert.equal(track.author_username, "UsuarioReal");

      // Tenta forjar user_id ao votar
      const voteRes = await trackVotePost({
        request: makeRequest(`/api/tracks/${track.id}/vote`, {
          method: "POST",
          cookie: realUser.cookie,
          body: { value: 1, user_id: "9999" },
        }),
        env,
        params: { id: String(track.id) },
      });
      assert.equal(voteRes.status, 200);

      const voteRow = db.sqlite
        .prepare("SELECT user_id, value FROM track_votes WHERE track_id = ?")
        .get(track.id);
      assert.equal(voteRow.user_id, "3001");
      assert.equal(voteRow.value, 1);
    } finally {
      db.close();
    }
  });

  test("403 ao deletar sala ou faixa de outro usuário; mas criador da sala PODE deletar faixa dentro da própria sala", async () => {
    const { db, env } = createTestEnv();
    try {
      const roomOwner = seedAuthenticatedUser(db, {
        user_id: "4001",
        username: "DonoDaSala",
      });
      const trackAuthor = seedAuthenticatedUser(db, {
        user_id: "4002",
        username: "AutorDaFaixa",
      });
      const intruder = seedAuthenticatedUser(db, {
        user_id: "4003",
        username: "TerceiroIntruso",
      });

      const { room } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: roomOwner.cookie,
            body: { name: "Sala de Permissões", theme_tag: "Eletrônica" },
          }),
          env,
        })
      );

      const { track: track1 } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: trackAuthor.cookie,
            body: {
              title: "Faixa do Colaborador 1",
              genre: "Eletrônica",
              url: "https://youtu.be/dQw4w9WgXcQ",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      const { track: track2 } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: trackAuthor.cookie,
            body: {
              title: "Faixa do Colaborador 2",
              genre: "Eletrônica",
              url: "https://youtu.be/9bZkp7q19f0",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      // Intruso NÃO pode deletar a sala
      const delRoomByIntruder = await roomDetailDelete({
        request: makeRequest(`/api/rooms/${room.id}`, {
          method: "DELETE",
          cookie: intruder.cookie,
        }),
        env,
        params: { id: String(room.id) },
      });
      assert.equal(delRoomByIntruder.status, 403);

      // Colaborador NÃO pode deletar a sala de outro usuário
      const delRoomByCollaborator = await roomDetailDelete({
        request: makeRequest(`/api/rooms/${room.id}`, {
          method: "DELETE",
          cookie: trackAuthor.cookie,
        }),
        env,
        params: { id: String(room.id) },
      });
      assert.equal(delRoomByCollaborator.status, 403);

      // Intruso NÃO pode deletar faixa de outro usuário
      const delTrackByIntruder = await trackDelete({
        request: makeRequest(`/api/tracks/${track1.id}`, {
          method: "DELETE",
          cookie: intruder.cookie,
        }),
        env,
        params: { id: String(track1.id) },
      });
      assert.equal(delTrackByIntruder.status, 403);

      // Criador da sala PODE deletar faixa submetida por outro usuário na própria sala
      const delTrackByRoomOwner = await trackDelete({
        request: makeRequest(`/api/tracks/${track1.id}`, {
          method: "DELETE",
          cookie: roomOwner.cookie,
        }),
        env,
        params: { id: String(track1.id) },
      });
      assert.equal(delTrackByRoomOwner.status, 200);
      const del1Data = await readJson(delTrackByRoomOwner);
      assert.equal(del1Data.deletedTrackId, track1.id);

      // Autor da faixa PODE deletar sua própria faixa
      const delTrackByAuthor = await trackDelete({
        request: makeRequest(`/api/tracks/${track2.id}`, {
          method: "DELETE",
          cookie: trackAuthor.cookie,
        }),
        env,
        params: { id: String(track2.id) },
      });
      assert.equal(delTrackByAuthor.status, 200);
    } finally {
      db.close();
    }
  });

  test("400 para payloads malformados, campos vazios/longos demais e votos fora de {-1, 0, 1}", async () => {
    const { db, env } = createTestEnv();
    try {
      const user = seedAuthenticatedUser(db, {
        user_id: "5001",
        username: "ValidatorUser",
      });

      // JSON quebrado e array em POST /api/rooms
      const badJsonRes = await roomsPost({
        request: makeRequest("/api/rooms", {
          method: "POST",
          cookie: user.cookie,
          body: "{json-invalido",
        }),
        env,
      });
      assert.equal(badJsonRes.status, 400);

      const arrayJsonRes = await roomsPost({
        request: makeRequest("/api/rooms", {
          method: "POST",
          cookie: user.cookie,
          body: "[]",
        }),
        env,
      });
      assert.equal(arrayJsonRes.status, 400);

      // Campos vazios ou longos demais em sala
      const invalidRoomPayloads = [
        { name: "" },
        { name: "AB" },
        { name: "A".repeat(61) },
        { name: "Sala Válida", description: "D".repeat(221) },
        { name: "Sala Válida", theme_tag: "X" },
        { name: "Sala Válida", theme_tag: "T".repeat(31) },
      ];
      for (const payload of invalidRoomPayloads) {
        const res = await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: user.cookie,
            body: payload,
          }),
          env,
        });
        assert.equal(res.status, 400, `Esperava 400 para sala ${JSON.stringify(payload)}`);
      }

      // Cria sala válida para testar faixas e votos inválidos
      const { room } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: user.cookie,
            body: { name: "Sala Validação", theme_tag: "Jazz" },
          }),
          env,
        })
      );

      const invalidTrackPayloads = [
        { title: "", genre: "Jazz", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "A", genre: "Jazz", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "T".repeat(121), genre: "Jazz", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "Faixa OK", artist: "A".repeat(81), genre: "Jazz", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "Faixa OK", genre: "", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "Faixa OK", genre: "G".repeat(41), url: "https://youtu.be/dQw4w9WgXcQ" },
      ];
      for (const payload of invalidTrackPayloads) {
        const res = await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: user.cookie,
            body: payload,
          }),
          env,
          params: { id: String(room.id) },
        });
        assert.equal(res.status, 400, `Esperava 400 para faixa ${JSON.stringify(payload)}`);
      }

      const { track } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: user.cookie,
            body: {
              title: "Take Five",
              artist: "Dave Brubeck",
              genre: "Jazz",
              url: "https://youtu.be/vmDDOFXSgAs",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      // Votos fora de {-1, 0, 1}
      const invalidVotes = [2, -2, 0.5, -0.5, "1", "-1", null, undefined, true, false, {}];
      for (const badValue of invalidVotes) {
        const res = await trackVotePost({
          request: makeRequest(`/api/tracks/${track.id}/vote`, {
            method: "POST",
            cookie: user.cookie,
            body: { value: badValue },
          }),
          env,
          params: { id: String(track.id) },
        });
        assert.equal(res.status, 400, `Esperava 400 para voto value=${JSON.stringify(badValue)}`);
      }

      // ID de faixa não numérico
      const badIdVote = await trackVotePost({
        request: makeRequest("/api/tracks/not-a-number/vote", {
          method: "POST",
          cookie: user.cookie,
          body: { value: 1 },
        }),
        env,
        params: { id: "not-a-number" },
      });
      assert.equal(badIdVote.status, 400);

      const badIdDelete = await trackDelete({
        request: makeRequest("/api/tracks/abc", {
          method: "DELETE",
          cookie: user.cookie,
        }),
        env,
        params: { id: "abc" },
      });
      assert.equal(badIdDelete.status, 400);
    } finally {
      db.close();
    }
  });

  test("validação rigorosa de URLs: aceita YouTube/Spotify/SoundCloud legítimos e rejeita (400) links perigosos ou falsos", async () => {
    const validCases = [
      {
        input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s",
        provider: "youtube",
        normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      },
      {
        input: "https://youtu.be/dQw4w9WgXcQ?si=share123",
        provider: "youtube",
        normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      },
      {
        input: "https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
        provider: "youtube",
        normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      },
      {
        input: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        provider: "youtube",
        normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      },
      {
        input: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc",
        provider: "spotify",
        normalizedUrl: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
        embedUrl:
          "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator&theme=0",
      },
      {
        input: "https://open.spotify.com/intl-pt/track/4cOdK2wGLETKBW3PvgPWqT",
        provider: "spotify",
        normalizedUrl: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
        embedUrl:
          "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator&theme=0",
      },
      {
        input: "https://soundcloud.com/kavinsky/nightcall?in=synthwave",
        provider: "soundcloud",
        normalizedUrl: "https://soundcloud.com/kavinsky/nightcall",
        embedUrl:
          "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fkavinsky%2Fnightcall&color=%234f46e5&auto_play=false&show_teaser=false",
      },
      {
        input: "https://soundcloud.com/kavinsky/sets/outrun-playlist",
        provider: "soundcloud",
        normalizedUrl: "https://soundcloud.com/kavinsky/sets/outrun-playlist",
        embedUrl:
          "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fkavinsky%2Fsets%2Foutrun-playlist&color=%234f46e5&auto_play=false&show_teaser=false",
      },
    ];

    for (const tc of validCases) {
      const result = validateTrackUrl(tc.input);
      assert.equal(result.valid, true, `URL deveria ser aceita: ${tc.input}`);
      assert.equal(result.provider, tc.provider);
      assert.equal(result.normalizedUrl, tc.normalizedUrl);
      assert.equal(result.embedUrl, tc.embedUrl);
    }

    const rejectedUrls = [
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "http://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "https://evil-youtube.com/watch?v=dQw4w9WgXcQ",
      "https://open.spotify.com.attacker.org/track/4cOdK2wGLETKBW3PvgPWqT",
      "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
      "https://soundcloud.com/discover/test",
      "https://soundcloud.com/stream/test",
      "https://soundcloud.com/search/test",
      "https://soundcloud.com/artist-only",
      "https://www.youtube.com/watch?v=curto",
      "https://open.spotify.com/track/shortid",
      "https://vimeo.com/12345678",
    ];

    // Verifica tanto no validador unitário quanto na rota HTTP POST /api/rooms/:id/tracks
    const { db, env } = createTestEnv();
    try {
      const user = seedAuthenticatedUser(db, { user_id: "6001", username: "UrlTester" });
      const { room } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: user.cookie,
            body: { name: "Sala URLs", theme_tag: "Synthwave" },
          }),
          env,
        })
      );

      for (const badUrl of rejectedUrls) {
        assert.equal(
          validateTrackUrl(badUrl).valid,
          false,
          `Validador deveria rejeitar: ${badUrl}`
        );

        const res = await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: user.cookie,
            body: {
              title: "Tentativa Maliciosa",
              genre: "Synthwave",
              url: badUrl,
            },
          }),
          env,
          params: { id: String(room.id) },
        });
        assert.equal(res.status, 400, `Rota deveria retornar 400 para URL: ${badUrl}`);
      }
    } finally {
      db.close();
    }
  });

  test("409 Conflict para faixa duplicada na mesma sala (incluindo formatos equivalentes) e permite na sala diferente", async () => {
    const { db, env } = createTestEnv();
    try {
      const user = seedAuthenticatedUser(db, { user_id: "7001", username: "DupTester" });

      const { room: roomA } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: user.cookie,
            body: { name: "Sala Alpha", theme_tag: "Synthwave" },
          }),
          env,
        })
      );

      const { room: roomB } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: user.cookie,
            body: { name: "Sala Beta", theme_tag: "Synthwave" },
          }),
          env,
        })
      );

      // 1. Primeira inserção via youtu.be
      const firstYt = await roomTracksPost({
        request: makeRequest(`/api/rooms/${roomA.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Never Gonna Give You Up",
            genre: "Pop",
            url: "https://youtu.be/dQw4w9WgXcQ",
          },
        }),
        env,
        params: { id: String(roomA.id) },
      });
      assert.equal(firstYt.status, 201);

      // 2. Mesma faixa via youtube.com/watch?v=... na MESMA sala -> 409
      const dupYtWatch = await roomTracksPost({
        request: makeRequest(`/api/rooms/${roomA.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Mesma Música Outro Link",
            genre: "Pop",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
          },
        }),
        env,
        params: { id: String(roomA.id) },
      });
      assert.equal(dupYtWatch.status, 409);
      assert.equal((await readJson(dupYtWatch)).code, "DUPLICATE_TRACK");

      // 3. Mesma faixa via music.youtube.com na MESMA sala -> 409
      const dupYtMusic = await roomTracksPost({
        request: makeRequest(`/api/rooms/${roomA.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Mesma Música YT Music",
            genre: "Pop",
            url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        }),
        env,
        params: { id: String(roomA.id) },
      });
      assert.equal(dupYtMusic.status, 409);

      // 4. Spotify track vs intl-pt/track na MESMA sala -> 409
      const firstSp = await roomTracksPost({
        request: makeRequest(`/api/rooms/${roomA.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Spotify Track",
            genre: "Eletrônica",
            url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
          },
        }),
        env,
        params: { id: String(roomA.id) },
      });
      assert.equal(firstSp.status, 201);

      const dupSpIntl = await roomTracksPost({
        request: makeRequest(`/api/rooms/${roomA.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Spotify Track Intl",
            genre: "Eletrônica",
            url: "https://open.spotify.com/intl-pt/track/4cOdK2wGLETKBW3PvgPWqT?si=zzz",
          },
        }),
        env,
        params: { id: String(roomA.id) },
      });
      assert.equal(dupSpIntl.status, 409);

      // 5. Mesma faixa em OUTRA sala -> 201 permitido
      const otherRoomYt = await roomTracksPost({
        request: makeRequest(`/api/rooms/${roomB.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Permitido na Sala Beta",
            genre: "Pop",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        }),
        env,
        params: { id: String(roomB.id) },
      });
      assert.equal(otherRoomYt.status, 201);
    } finally {
      db.close();
    }
  });

  test("proteção contra SQL Injection em busca (?q=), nome de sala e gênero sem vazar nem corromper dados", async () => {
    const { db, env } = createTestEnv();
    try {
      const user = seedAuthenticatedUser(db, { user_id: "8001", username: "SecAuditor" });

      // Cria sala normal
      await roomsPost({
        request: makeRequest("/api/rooms", {
          method: "POST",
          cookie: user.cookie,
          body: { name: "Sala Normal de Estudo", theme_tag: "Lo-Fi" },
        }),
        env,
      });

      // Cria sala com payload clássico de SQLi no nome
      const sqliRoomName = "Rock'; DROP TABLE rooms; --";
      const sqliRoomRes = await roomsPost({
        request: makeRequest("/api/rooms", {
          method: "POST",
          cookie: user.cookie,
          body: { name: sqliRoomName, theme_tag: "Rock' OR '1'='1" },
        }),
        env,
      });
      assert.equal(sqliRoomRes.status, 201);
      const { room: sqliRoom } = await readJson(sqliRoomRes);
      assert.equal(sqliRoom.name, sqliRoomName);

      // Cria faixa com payload SQLi no gênero
      const sqliGenre = "Metal' UNION SELECT token FROM sessions";
      const sqliTrackRes = await roomTracksPost({
        request: makeRequest(`/api/rooms/${sqliRoom.id}/tracks`, {
          method: "POST",
          cookie: user.cookie,
          body: {
            title: "Track'); DELETE FROM track_votes; --",
            genre: sqliGenre,
            url: "https://youtu.be/dQw4w9WgXcQ",
          },
        }),
        env,
        params: { id: String(sqliRoom.id) },
      });
      assert.equal(sqliTrackRes.status, 201);
      const { track } = await readJson(sqliTrackRes);
      assert.equal(track.genre, sqliGenre);

      // Busca ?q=' OR 1=1 -- NÃO deve vazar todas as salas
      const searchRes = await roomsGet({
        request: makeRequest(`/api/rooms?q=${encodeURIComponent("' OR 1=1 --")}`),
        env,
      });
      assert.equal(searchRes.status, 200);
      const searchData = await readJson(searchRes);
      assert.equal(searchData.rooms.length, 0);

      // Busca com wildcards % e _ escapados NÃO deve retornar todas as salas
      const wildcardRes = await roomsGet({
        request: makeRequest(`/api/rooms?q=${encodeURIComponent("%")}`),
        env,
      });
      assert.equal((await readJson(wildcardRes)).rooms.length, 0);

      // Tabela rooms e sessions continuam intactas
      const allRooms = await readJson(
        await roomsGet({ request: makeRequest("/api/rooms"), env })
      );
      assert.equal(allRooms.rooms.length, 2);
      const sessionCount = db.sqlite
        .prepare("SELECT COUNT(*) AS total FROM sessions")
        .get();
      assert.equal(Number(sessionCount.total), 1);
    } finally {
      db.close();
    }
  });
});

/* ============================================================================
 * 4. Votação, Saldo no Servidor, Reordenação e Exclusão em Cascata
 * ============================================================================ */

describe("4. Votação, Reordenação por Saldo no Servidor e Cascata", () => {
  test("múltiplos usuários votando (+1, -1, troca, remoção 0), voto único e ordenação score DESC, upvotes DESC, created_at ASC, id ASC", async () => {
    const { db, env } = createTestEnv();
    try {
      const alice = seedAuthenticatedUser(db, { user_id: "9001", username: "Alice" });
      const bob = seedAuthenticatedUser(db, { user_id: "9002", username: "Bob" });
      const carol = seedAuthenticatedUser(db, { user_id: "9003", username: "Carol" });

      const { room } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: alice.cookie,
            body: { name: "Ranking Democrático", theme_tag: "Synthwave" },
          }),
          env,
        })
      );

      // Cria 3 faixas na ordem T1 -> T2 -> T3
      const { track: t1 } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: alice.cookie,
            body: {
              title: "Faixa 1 - Baseline",
              genre: "Synthwave",
              url: "https://youtu.be/aaaaaaaaaaa",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      const { track: t2 } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: bob.cookie,
            body: {
              title: "Faixa 2 - Campeã",
              genre: "Synthwave",
              url: "https://youtu.be/bbbbbbbbbbb",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      const { track: t3 } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room.id}/tracks`, {
            method: "POST",
            cookie: carol.cookie,
            body: {
              title: "Faixa 3 - Empate com Upvote",
              genre: "Synthwave",
              url: "https://youtu.be/ccccccccccc",
            },
          }),
          env,
          params: { id: String(room.id) },
        })
      );

      // T2 recebe +1 de Alice e +1 de Bob (score = +2, upvotes = 2, downvotes = 0)
      await trackVotePost({
        request: makeRequest(`/api/tracks/${t2.id}/vote`, {
          method: "POST",
          cookie: alice.cookie,
          body: { value: 1 },
        }),
        env,
        params: { id: String(t2.id) },
      });

      // Repetir +1 de Alice é idempotente (voto único por track_id, user_id)
      const repeatVote = await readJson(
        await trackVotePost({
          request: makeRequest(`/api/tracks/${t2.id}/vote`, {
            method: "POST",
            cookie: alice.cookie,
            body: { value: 1 },
          }),
          env,
          params: { id: String(t2.id) },
        })
      );
      assert.equal(repeatVote.score, 1);
      assert.equal(repeatVote.upvotes, 1);
      assert.equal(repeatVote.downvotes, 0);
      assert.equal(repeatVote.user_vote, 1);

      const bobUpT2 = await readJson(
        await trackVotePost({
          request: makeRequest(`/api/tracks/${t2.id}/vote`, {
            method: "POST",
            cookie: bob.cookie,
            body: { value: 1 },
          }),
          env,
          params: { id: String(t2.id) },
        })
      );
      assert.equal(bobUpT2.score, 2);
      assert.equal(bobUpT2.upvotes, 2);
      assert.equal(bobUpT2.downvotes, 0);

      // T3 recebe +1 de Alice e -1 de Bob (score = 0, upvotes = 1, downvotes = 1)
      // T1 fica sem votos (score = 0, upvotes = 0, downvotes = 0)
      // Pelo critério upvotes DESC, T3 deve ficar ACIMA de T1 mesmo tendo sido criada depois!
      await trackVotePost({
        request: makeRequest(`/api/tracks/${t3.id}/vote`, {
          method: "POST",
          cookie: alice.cookie,
          body: { value: 1 },
        }),
        env,
        params: { id: String(t3.id) },
      });
      const bobDownT3 = await readJson(
        await trackVotePost({
          request: makeRequest(`/api/tracks/${t3.id}/vote`, {
            method: "POST",
            cookie: bob.cookie,
            body: { value: -1 },
          }),
          env,
          params: { id: String(t3.id) },
        })
      );
      assert.equal(bobDownT3.score, 0);
      assert.equal(bobDownT3.upvotes, 1);
      assert.equal(bobDownT3.downvotes, 1);
      assert.equal(bobDownT3.user_vote, -1);

      // Verifica ordenação no GET /api/rooms/:id autenticado como Bob (e por slug!)
      const detailAsBob = await readJson(
        await roomDetailGet({
          request: makeRequest(`/api/rooms/${room.slug}`, { cookie: bob.cookie }),
          env,
          params: { id: room.slug },
        })
      );

      assert.deepEqual(
        detailAsBob.tracks.map((t) => t.id),
        [t2.id, t3.id, t1.id],
        "Ordem esperada: T2 (score +2), T3 (score 0, up 1), T1 (score 0, up 0)"
      );
      assert.deepEqual(
        detailAsBob.tracks.map((t) => ({
          id: t.id,
          score: t.score,
          upvotes: t.upvotes,
          downvotes: t.downvotes,
          user_vote: t.user_vote,
        })),
        [
          { id: t2.id, score: 2, upvotes: 2, downvotes: 0, user_vote: 1 },
          { id: t3.id, score: 0, upvotes: 1, downvotes: 1, user_vote: -1 },
          { id: t1.id, score: 0, upvotes: 0, downvotes: 0, user_vote: 0 },
        ]
      );

      // Verifica user_vote = 0 para visitante não autenticado
      const detailAnon = await readJson(
        await roomDetailGet({
          request: makeRequest(`/api/rooms/${room.id}`),
          env,
          params: { id: String(room.id) },
        })
      );
      assert.deepEqual(
        detailAnon.tracks.map((t) => t.user_vote),
        [0, 0, 0]
      );

      // Verifica top_track_title em GET /api/rooms
      const listData = await readJson(
        await roomsGet({ request: makeRequest("/api/rooms"), env })
      );
      assert.equal(listData.rooms[0].top_track_title, "Faixa 2 - Campeã");
      assert.equal(listData.rooms[0].track_count, 3);
      assert.equal(listData.rooms[0].total_votes, 4);

      // Troca de voto: Alice muda T2 de +1 para -1 (T2 vai para score 0, up 1, down 1)
      const switchVote = await readJson(
        await trackVotePost({
          request: makeRequest(`/api/tracks/${t2.id}/vote`, {
            method: "POST",
            cookie: alice.cookie,
            body: { value: -1 },
          }),
          env,
          params: { id: String(t2.id) },
        })
      );
      assert.equal(switchVote.score, 0);
      assert.equal(switchVote.upvotes, 1);
      assert.equal(switchVote.downvotes, 1);
      assert.equal(switchVote.user_vote, -1);

      // Garante que existe apenas 1 registro para (t2.id, alice.user_id)
      const countAliceT2 = db.sqlite
        .prepare("SELECT COUNT(*) AS c FROM track_votes WHERE track_id = ? AND user_id = ?")
        .get(t2.id, alice.user_id);
      assert.equal(Number(countAliceT2.c), 1);

      // Remoção de voto (value = 0): Bob remove -1 de T3 -> T3 sobe para score +1 (assume #1!)
      const removeVote = await readJson(
        await trackVotePost({
          request: makeRequest(`/api/tracks/${t3.id}/vote`, {
            method: "POST",
            cookie: bob.cookie,
            body: { value: 0 },
          }),
          env,
          params: { id: String(t3.id) },
        })
      );
      assert.equal(removeVote.score, 1);
      assert.equal(removeVote.upvotes, 1);
      assert.equal(removeVote.downvotes, 0);
      assert.equal(removeVote.user_vote, 0);

      // Confirma que T3 assumiu o topo da sala no servidor
      const detailAfterRebalance = await readJson(
        await roomDetailGet({
          request: makeRequest(`/api/rooms/${room.id}`, { cookie: alice.cookie }),
          env,
          params: { id: String(room.id) },
        })
      );
      assert.deepEqual(
        detailAfterRebalance.tracks.map((t) => t.id),
        [t3.id, t2.id, t1.id],
        "Após remoção do downvote em T3 e troca em T2, T3 (+1) deve liderar sobre T2 (0, up 1) e T1 (0, up 0)"
      );
    } finally {
      db.close();
    }
  });

  test("exclusão de sala remove em cascata todas as faixas e votos dela, preservando outras salas", async () => {
    const { db, env } = createTestEnv();
    try {
      const owner = seedAuthenticatedUser(db, { user_id: "9501", username: "CascadeOwner" });

      const { room: room1 } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: owner.cookie,
            body: { name: "Sala a Excluir", theme_tag: "Metal" },
          }),
          env,
        })
      );

      const { room: room2 } = await readJson(
        await roomsPost({
          request: makeRequest("/api/rooms", {
            method: "POST",
            cookie: owner.cookie,
            body: { name: "Sala a Preservar", theme_tag: "Jazz" },
          }),
          env,
        })
      );

      const { track: r1Track } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room1.id}/tracks`, {
            method: "POST",
            cookie: owner.cookie,
            body: {
              title: "Master of Puppets",
              genre: "Metal",
              url: "https://youtu.be/E0ozmU9cJDg",
            },
          }),
          env,
          params: { id: String(room1.id) },
        })
      );

      const { track: r2Track } = await readJson(
        await roomTracksPost({
          request: makeRequest(`/api/rooms/${room2.id}/tracks`, {
            method: "POST",
            cookie: owner.cookie,
            body: {
              title: "So What",
              genre: "Jazz",
              url: "https://youtu.be/ylXk1LBvIqU",
            },
          }),
          env,
          params: { id: String(room2.id) },
        })
      );

      await trackVotePost({
        request: makeRequest(`/api/tracks/${r1Track.id}/vote`, {
          method: "POST",
          cookie: owner.cookie,
          body: { value: 1 },
        }),
        env,
        params: { id: String(r1Track.id) },
      });

      await trackVotePost({
        request: makeRequest(`/api/tracks/${r2Track.id}/vote`, {
          method: "POST",
          cookie: owner.cookie,
          body: { value: 1 },
        }),
        env,
        params: { id: String(r2Track.id) },
      });

      const delRes = await roomDetailDelete({
        request: makeRequest(`/api/rooms/${room1.id}`, {
          method: "DELETE",
          cookie: owner.cookie,
        }),
        env,
        params: { id: String(room1.id) },
      });
      assert.equal(delRes.status, 200);
      assert.equal((await readJson(delRes)).deletedRoomId, room1.id);

      // Sala 1 e seus filhos devem ter desaparecido
      const r1Get = await roomDetailGet({
        request: makeRequest(`/api/rooms/${room1.id}`),
        env,
        params: { id: String(room1.id) },
      });
      assert.equal(r1Get.status, 404);

      const r1TracksCount = db.sqlite
        .prepare("SELECT COUNT(*) AS c FROM tracks WHERE room_id = ?")
        .get(room1.id);
      assert.equal(Number(r1TracksCount.c), 0);

      const r1VotesCount = db.sqlite
        .prepare("SELECT COUNT(*) AS c FROM track_votes WHERE track_id = ?")
        .get(r1Track.id);
      assert.equal(Number(r1VotesCount.c), 0);

      // Sala 2, sua faixa e seu voto permanecem intactos
      const r2TracksCount = db.sqlite
        .prepare("SELECT COUNT(*) AS c FROM tracks WHERE room_id = ?")
        .get(room2.id);
      assert.equal(Number(r2TracksCount.c), 1);

      const r2VotesCount = db.sqlite
        .prepare("SELECT COUNT(*) AS c FROM track_votes WHERE track_id = ?")
        .get(r2Track.id);
      assert.equal(Number(r2VotesCount.c), 1);
    } finally {
      db.close();
    }
  });
});

/* ============================================================================
 * 5. Auditoria Estática de Frontend, Segurança DOM, CSS, Sintaxe e Rubrica
 * ============================================================================ */

describe("5. Auditoria Estática de Frontend e Conformidade de Rubrica", () => {
  test("ausência de frameworks proibidos no HTML, JS e eventual package.json", () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, "public", "index.html"), "utf8");
    const appJs = fs.readFileSync(path.join(PROJECT_ROOT, "public", "app.js"), "utf8");

    const prohibitedCdnRegex =
      /(?:unpkg\.com|esm\.sh|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|cdn\.tailwindcss\.com).*(?:react|vue|angular|svelte|solid|jquery|tailwind)/i;
    assert.equal(
      prohibitedCdnRegex.test(html),
      false,
      "index.html não pode carregar frameworks proibidos via CDN"
    );

    const prohibitedImportRegex =
      /\b(?:from|require\s*\()\s*["'](?:react|react-dom|vue|next|nuxt|@angular\/core|svelte|solid-js|jquery)["']/i;
    assert.equal(
      prohibitedImportRegex.test(appJs),
      false,
      "app.js não pode importar frameworks proibidos"
    );

    const pkgPath = path.join(PROJECT_ROOT, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      for (const fw of [
        "react",
        "react-dom",
        "vue",
        "next",
        "nuxt",
        "@angular/core",
        "svelte",
        "solid-js",
        "jquery",
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(deps, fw),
          false,
          `Dependência proibida encontrada em package.json: ${fw}`
        );
      }
    }
  });

  test("ausência de innerHTML, outerHTML, insertAdjacentHTML e document.write em public/app.js", () => {
    const appJs = fs.readFileSync(path.join(PROJECT_ROOT, "public", "app.js"), "utf8");
    assert.equal(/\.\s*innerHTML\b/.test(appJs), false, "innerHTML é proibido em public/app.js");
    assert.equal(/\.\s*outerHTML\b/.test(appJs), false, "outerHTML é proibido em public/app.js");
    assert.equal(
      /\.\s*insertAdjacentHTML\b/.test(appJs),
      false,
      "insertAdjacentHTML é proibido em public/app.js"
    );
    assert.equal(
      /\bdocument\s*\.\s*write\b/.test(appJs),
      false,
      "document.write é proibido em public/app.js"
    );
  });

  test("ausência de text-shadow (exceto none) e ausência de filter: drop-shadow em public/styles.css", () => {
    const css = fs.readFileSync(path.join(PROJECT_ROOT, "public", "styles.css"), "utf8");
    // Remove comentários CSS antes de auditar
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

    const textShadowMatches = cleanCss.match(/text-shadow\s*:\s*([^;}{]+)/gi) || [];
    for (const match of textShadowMatches) {
      const value = match.split(":")[1].trim().toLowerCase();
      assert.equal(
        value,
        "none",
        `Propriedade proibida encontrada em styles.css: ${match}`
      );
    }

    assert.equal(
      /drop-shadow\s*\(/i.test(cleanCss),
      false,
      "filter: drop-shadow(...) é proibido em public/styles.css"
    );
  });

  test("presença obrigatória da chave única em README.md e dentro de <footer> em public/index.html, LICENSE MIT, AGENTS.md e skills/", () => {
    const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
    assert.ok(
      readme.toUpperCase().includes(PROJECT_KEY),
      "README.md deve conter a Chave Única"
    );

    const html = fs.readFileSync(path.join(PROJECT_ROOT, "public", "index.html"), "utf8");
    const footerMatches = [...html.matchAll(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gi)];
    assert.ok(footerMatches.length >= 1, "public/index.html deve possuir elemento <footer>");
    const footerContent = footerMatches.map((m) => m[1]).join("\n");
    assert.ok(
      footerContent.toUpperCase().includes(PROJECT_KEY),
      "<footer> deve conter a Chave Única P26-2B-0018-0402-94DD-FCB7"
    );
    assert.match(footerContent, /Turma\s+2B/i, "<footer> deve mencionar Turma 2B");
    assert.match(footerContent, /MIT/i, "<footer> deve mencionar Licença MIT");

    const license = fs.readFileSync(path.join(PROJECT_ROOT, "LICENSE"), "utf8");
    assert.match(license, /MIT License/i);
    assert.match(license, /Permission is hereby granted, free of charge/i);

    const agentsDoc = fs.readFileSync(path.join(PROJECT_ROOT, "AGENTS.md"), "utf8");
    assert.ok(agentsDoc.trim().length > 120);
    const agentHeadings = agentsDoc.match(/^#{2,4}\s+.*(?:Agente|Agent)\b.*$/gim) || [];
    assert.ok(agentHeadings.length >= 3, "AGENTS.md deve documentar no mínimo 3 agentes");
    assert.match(agentsDoc, /(?:teste|validação|validacao|auditoria)/i);

    const files = listProjectFilesRecursive(PROJECT_ROOT);
    const skillFiles = files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/i.test(f));
    assert.ok(skillFiles.length >= 3, "Deve haver pelo menos 3 skills em skills/*/SKILL.md");
  });

  test("verificação de sintaxe JS (node --check) de todos os arquivos .js/.mjs do projeto", () => {
    const allFiles = listProjectFilesRecursive(PROJECT_ROOT);
    const jsFiles = allFiles.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
    assert.ok(jsFiles.length >= 10, `Esperado ao menos 10 arquivos JS/MJS, encontrado ${jsFiles.length}`);

    for (const relPath of jsFiles) {
      const absPath = path.join(PROJECT_ROOT, relPath);
      execFileSync(process.execPath, ["--check", absPath], { stdio: "pipe" });
    }
  });

  test("validadores unitários extras (validateRoomInput, validateTrackInput, validateVoteValue)", () => {
    assert.equal(validateRoomInput({ name: "Synthwave para Codar" }).valid, true);
    assert.equal(validateRoomInput(null).valid, false);
    assert.equal(
      validateTrackInput({
        title: "Nightcall",
        artist: "Kavinsky",
        genre: "Synthwave",
        url: "https://youtu.be/MV_3Dpw-BRY",
      }).valid,
      true
    );
    assert.equal(validateVoteValue({ value: 1 }).valid, true);
    assert.equal(validateVoteValue({ value: -1 }).valid, true);
    assert.equal(validateVoteValue({ value: 0 }).valid, true);
    assert.equal(validateVoteValue({ value: "0" }).valid, false);
  });
});
