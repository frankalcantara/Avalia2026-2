// Autenticação: sessão, /api/me, logout, proteção de Origin e OAuth2 Discord
// com fetch simulado (nenhuma chamada real à rede).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  allRoutesExist,
  call,
  cookieFrom,
  createSession,
  createUser,
  insertEvent,
  load,
  login,
  makeEnv,
  mockDiscordFetch,
  sha256b64url,
} from "./helpers/app.mjs";

const PROFILE = {
  id: "80351110224678912",
  username: "nelly",
  global_name: "Nelly Silva",
  avatar: "8342729096ea3675442027381ff50dfe",
};

function assertSecureCookie(line, name) {
  assert.ok(line, `Set-Cookie ${name} ausente`);
  assert.ok(line.startsWith(`${name}=`), line);
  assert.match(line, /;\s*HttpOnly/i, `${name} sem HttpOnly`);
  assert.match(line, /;\s*Secure/i, `${name} sem Secure`);
  assert.match(line, /;\s*Path=\/(;|$)/i, `${name} sem Path=/`);
  assert.match(line, /;\s*SameSite=Lax/i, `${name} sem SameSite=Lax`);
  assert.doesNotMatch(line, /;\s*Domain=/i, "__Host- não pode ter Domain");
}

function isExpiredCookie(line) {
  return /Max-Age=0\b/i.test(line) || /Expires=Thu, 01 Jan 1970/i.test(line);
}

// ---------- sessão, /api/me, logout e Origin ----------

describe("sessão e /api/me", { skip: !allRoutesExist("me", "logout") && "rotas de auth ausentes" }, () => {
  test("sem cookie → 401 unauthenticated", async () => {
    const env = await makeEnv();
    const r = await call(await load("me"), "GET", { env, path: "/api/me" });
    assert.equal(r.status, 401, r.text);
    assert.equal(r.json.error, "unauthenticated");
    assert.equal(r.headers.get("Cache-Control"), "no-store");
  });

  test("cookie inválido, forjado ou expirado → 401", async () => {
    const env = await makeEnv();
    const u = await createUser(env);
    const expired = await createSession(env, u.user_id, { expiresIn: -1000 });
    const me = await load("me");
    for (const cookie of [
      "__Host-session=abc",
      `__Host-session=${"A".repeat(43)}`,
      expired,
      "session=qualquer",
    ]) {
      const r = await call(me, "GET", { env, path: "/api/me", cookie });
      assert.equal(r.status, 401, `${cookie}: ${r.text}`);
    }
  });

  test("o hash da sessão no D1 não é usado como cookie (só o valor bruto vale)", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    const hash = env.DB.query("SELECT id_hash FROM sessions")[0].id_hash;
    const r = await call(await load("me"), "GET", { env, path: "/api/me", cookie: `__Host-session=${hash}` });
    assert.equal(r.status, 401);
    const ok = await call(await load("me"), "GET", { env, path: "/api/me", cookie });
    assert.equal(ok.status, 200);
  });

  test("com sessão → 200 { user_id, username, global_name, avatar_url }", async () => {
    const env = await makeEnv();
    const { user, cookie } = await login(env, {
      user_id: PROFILE.id,
      username: "nelly",
      global_name: "Nelly",
      avatar: "abc123",
    });
    const r = await call(await load("me"), "GET", { env, path: "/api/me", cookie });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.user_id, user.user_id);
    assert.equal(r.json.username, "nelly");
    assert.equal(r.json.global_name, "Nelly");
    assert.equal(
      r.json.avatar_url,
      `https://cdn.discordapp.com/avatars/${PROFILE.id}/abc123.png?size=128`,
    );
  });

  test("sem avatar → avatar padrão (user_id >> 22) % 6", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env, { user_id: PROFILE.id, avatar: null });
    const r = await call(await load("me"), "GET", { env, path: "/api/me", cookie });
    const idx = (BigInt(PROFILE.id) >> 22n) % 6n;
    assert.equal(r.json.avatar_url, `https://cdn.discordapp.com/embed/avatars/${idx}.png`);
  });

  test("logout → 204, apaga a sessão no D1 e expira o cookie", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    const r = await call(await load("logout"), "POST", { env, path: "/api/auth/logout", cookie });
    assert.equal(r.status, 204, r.text);
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM sessions")[0].n, 0);
    const c = cookieFrom(r.setCookies, "__Host-session");
    assert.ok(c && isExpiredCookie(c.line), `cookie não expirado: ${r.setCookies}`);
    const me = await call(await load("me"), "GET", { env, path: "/api/me", cookie });
    assert.equal(me.status, 401);
  });

  test("logout com Origin de outro site → 403 e sessão mantida", async () => {
    const env = await makeEnv();
    const { cookie } = await login(env);
    const r = await call(await load("logout"), "POST", {
      env,
      path: "/api/auth/logout",
      cookie,
      origin: "https://evil.example",
    });
    assert.equal(r.status, 403, r.text);
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM sessions")[0].n, 1);
  });
});

describe("RSVP exige sessão e Origin", { skip: !allRoutesExist("rsvp") && "rsvp.js ausente" }, () => {
  test("POST/DELETE rsvp sem sessão → 401; Origin errado → 403", async () => {
    const env = await makeEnv();
    const owner = await login(env);
    const id = insertEvent(env, owner.user.user_id);
    const mod = await load("rsvp");
    const base = { env, path: `/api/events/${id}/rsvp`, params: { id: String(id) } };
    for (const m of ["POST", "DELETE"]) {
      const r1 = await call(mod, m, base);
      assert.equal(r1.status, 401, `${m}: ${r1.text}`);
      assert.equal(r1.json.error, "unauthenticated");
      const r2 = await call(mod, m, { ...base, cookie: owner.cookie, origin: "https://evil.example" });
      assert.equal(r2.status, 403, `${m}: ${r2.text}`);
      assert.equal(r2.json.error, "invalid_origin");
      const r3 = await call(mod, m, { ...base, cookie: owner.cookie, origin: null });
      assert.equal(r3.status, 403, `${m} sem Origin: ${r3.text}`);
    }
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM registrations")[0].n, 0);
  });
});

// ---------- OAuth2 Discord ----------

async function startLogin(env, query = "") {
  const r = await call(await load("login"), "GET", { env, path: `/api/auth/discord${query}` });
  assert.equal(r.status, 302, r.text);
  const loc = new URL(r.location);
  const state = loc.searchParams.get("state");
  const cookies = r.setCookies.map((c) => c.split(";")[0]).filter((p) => !p.endsWith("="));
  return { r, loc, state, cookies };
}

async function callback(env, { code = "codigo-de-teste", state, cookies = [] }) {
  const qs = new URLSearchParams();
  if (code !== null) qs.set("code", code);
  if (state !== null && state !== undefined) qs.set("state", state);
  return call(await load("callback"), "GET", {
    env,
    path: `/api/auth/discord/callback?${qs}`,
    cookie: cookies.length ? cookies : undefined,
  });
}

function assertRefused(r, msg) {
  assert.equal(r.status, 302, `${msg}: ${r.status} ${r.text}`);
  const loc = new URL(r.location, BASE_URL);
  assert.equal(loc.origin, BASE_URL, `${msg}: redireciona para fora`);
  assert.ok(loc.searchParams.get("erro"), `${msg}: esperado /?erro=<codigo>, veio ${r.location}`);
  const s = cookieFrom(r.setCookies, "__Host-session");
  assert.ok(!s || isExpiredCookie(s.line), `${msg}: não pode criar sessão`);
}

const oauthReady = allRoutesExist("login", "callback", "me");

describe("OAuth2 Discord", { skip: !oauthReady && "rotas OAuth ausentes" }, () => {
  test("início: 302 para discord.com/oauth2/authorize com state, cookie __Host-oauth-tx e resumo no D1", async () => {
    const env = await makeEnv();
    const { r, loc, state } = await startLogin(env);
    assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
    assert.equal(loc.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(loc.searchParams.get("response_type"), "code");
    assert.equal(loc.searchParams.get("scope"), "identify");
    assert.equal(loc.searchParams.get("redirect_uri"), `${BASE_URL}/api/auth/discord/callback`);
    assert.ok(state && state.length >= 43, `state fraco: ${state}`);
    assert.ok(!r.location.includes(CLIENT_SECRET), "Client Secret vazou na URL");

    const tx = cookieFrom(r.setCookies, "__Host-oauth-tx");
    assertSecureCookie(tx?.line, "__Host-oauth-tx");
    assert.match(tx.line, /Max-Age=600\b/i, "transação deve durar 10 min");

    const rows = env.DB.query("SELECT * FROM oauth_states");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state_hash, await sha256b64url(state), "D1 guarda SHA-256 do state");
    assert.equal(rows[0].id_hash, await sha256b64url(tx.value), "D1 guarda SHA-256 do cookie");
    assert.notEqual(rows[0].state_hash, state);
    assert.ok(rows[0].expires_at > Date.now());

    const second = await startLogin(env);
    assert.notEqual(second.state, state, "state precisa ser aleatório");
  });

  test("callback válido: troca o code, grava user_id/username/avatar, revoga token e devolve __Host-session", async () => {
    const env = await makeEnv();
    const { state, cookies } = await startLogin(env);
    const mock = mockDiscordFetch({ profile: PROFILE });
    let r;
    try {
      r = await callback(env, { state, cookies });
    } finally {
      mock.restore();
    }
    assert.equal(r.status, 302, r.text);
    assert.equal(new URL(r.location, BASE_URL).href, `${BASE_URL}/`);
    assert.ok(!(r.location + r.text).includes(CLIENT_SECRET));
    assert.ok(!(r.location + r.text).includes("access-token-falso"));

    // chamadas ao Discord
    const tokenCall = mock.calls.find((c) => c.url.includes("/oauth2/token") && !c.url.includes("revoke"));
    assert.ok(tokenCall, "não trocou o code");
    assert.equal(tokenCall.method, "POST");
    const form = new URLSearchParams(tokenCall.body);
    const auth = tokenCall.headers.get("Authorization") ?? "";
    const basic = auth.startsWith("Basic ")
      ? Buffer.from(auth.slice(6), "base64").toString()
      : `${form.get("client_id")}:${form.get("client_secret")}`;
    assert.equal(basic, `${CLIENT_ID}:${CLIENT_SECRET}`, "credenciais do app na troca do code");
    assert.equal(form.get("grant_type"), "authorization_code");
    assert.equal(form.get("code"), "codigo-de-teste");
    assert.equal(form.get("redirect_uri"), `${BASE_URL}/api/auth/discord/callback`);
    const meCall = mock.calls.find((c) => c.url.includes("/users/@me"));
    assert.ok(meCall, "não leu /users/@me");
    assert.equal(meCall.headers.get("Authorization"), "Bearer access-token-falso");
    assert.ok(mock.calls.some((c) => c.url.includes("/oauth2/token/revoke")), "não revogou o access token");

    // usuário importado
    const u = env.DB.query("SELECT * FROM discord_users WHERE user_id = ?", [PROFILE.id])[0];
    assert.ok(u, "discord_users sem o usuário");
    assert.equal(u.username, PROFILE.username);
    assert.equal(u.global_name, PROFILE.global_name);
    assert.equal(u.avatar, PROFILE.avatar);

    // sessão: cookie opaco de 43 chars, D1 só com o hash
    const s = cookieFrom(r.setCookies, "__Host-session");
    assertSecureCookie(s?.line, "__Host-session");
    assert.match(s.value, /^[A-Za-z0-9_-]{43}$/);
    assert.match(s.line, /Max-Age=28800\b/i, "sessão de 8 h");
    const sess = env.DB.query("SELECT * FROM sessions");
    assert.equal(sess.length, 1);
    assert.equal(sess[0].user_id, PROFILE.id);
    assert.equal(sess[0].id_hash, await sha256b64url(s.value));

    // transação apagada (uso único) e cookie da transação expirado
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM oauth_states")[0].n, 0);
    const tx = cookieFrom(r.setCookies, "__Host-oauth-tx");
    assert.ok(!tx || isExpiredCookie(tx.line), "cookie __Host-oauth-tx deveria expirar");

    // o cookie funciona em /api/me
    const me = await call(await load("me"), "GET", { env, path: "/api/me", cookie: s.pair });
    assert.equal(me.status, 200, me.text);
    assert.equal(me.json.user_id, PROFILE.id);
    assert.equal(me.json.username, PROFILE.username);
    assert.equal(
      me.json.avatar_url,
      `https://cdn.discordapp.com/avatars/${PROFILE.id}/${PROFILE.avatar}.png?size=128`,
    );
  });

  test("segundo login do mesmo usuário atualiza o perfil (upsert)", async () => {
    const env = await makeEnv();
    for (const username of ["antigo", "novo"]) {
      const { state, cookies } = await startLogin(env);
      const mock = mockDiscordFetch({ profile: { ...PROFILE, username } });
      try {
        const r = await callback(env, { state, cookies });
        assert.equal(r.status, 302);
      } finally {
        mock.restore();
      }
    }
    const rows = env.DB.query("SELECT username FROM discord_users");
    assert.deepEqual(rows, [{ username: "novo" }]);
  });

  test("state errado → recusado, sem trocar o code", async () => {
    const env = await makeEnv();
    const { cookies } = await startLogin(env);
    const mock = mockDiscordFetch({ profile: PROFILE });
    try {
      const r = await callback(env, { state: "X".repeat(43), cookies });
      assertRefused(r, "state errado");
      assert.equal(mock.calls.length, 0, "não deveria chamar o Discord");
    } finally {
      mock.restore();
    }
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM sessions")[0].n, 0);
  });

  test("state reutilizado → recusado na segunda vez", async () => {
    const env = await makeEnv();
    const { state, cookies } = await startLogin(env);
    const mock = mockDiscordFetch({ profile: PROFILE });
    try {
      const ok = await callback(env, { state, cookies });
      assert.ok(cookieFrom(ok.setCookies, "__Host-session"), ok.text);
      const callsAfterFirst = mock.calls.length;
      const again = await callback(env, { state, cookies });
      assertRefused(again, "state reutilizado");
      assert.equal(mock.calls.length, callsAfterFirst, "reuso não pode chamar o Discord");
    } finally {
      mock.restore();
    }
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM sessions")[0].n, 1);
  });

  test("state certo sem o cookie da transação (ou de outra transação) → recusado", async () => {
    const env = await makeEnv();
    const a = await startLogin(env);
    const b = await startLogin(env);
    const mock = mockDiscordFetch({ profile: PROFILE });
    try {
      assertRefused(await callback(env, { state: a.state, cookies: [] }), "sem cookie");
      assertRefused(await callback(env, { state: a.state, cookies: b.cookies }), "cookie de outra transação");
      assert.equal(mock.calls.length, 0);
    } finally {
      mock.restore();
    }
  });

  test("transação expirada → recusada", async () => {
    const env = await makeEnv();
    const { state, cookies } = await startLogin(env);
    env.DB.query("UPDATE oauth_states SET expires_at = ?", [Date.now() - 1]);
    const mock = mockDiscordFetch({ profile: PROFILE });
    try {
      assertRefused(await callback(env, { state, cookies }), "expirada");
    } finally {
      mock.restore();
    }
  });

  test("sem code ou com ?error=access_denied → recusado", async () => {
    const env = await makeEnv();
    const { state, cookies } = await startLogin(env);
    const mock = mockDiscordFetch({ profile: PROFILE });
    try {
      assertRefused(await callback(env, { state, cookies, code: null }), "sem code");
      const denied = await call(await load("callback"), "GET", {
        env,
        path: `/api/auth/discord/callback?error=access_denied&state=${state}`,
        cookie: cookies,
      });
      assertRefused(denied, "access_denied");
    } finally {
      mock.restore();
    }
    assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM sessions")[0].n, 0);
  });

  test("falha na troca do code ou no /users/@me → recusado sem sessão", async () => {
    for (const fail of [{ tokenStatus: 400 }, { meStatus: 401 }]) {
      const env = await makeEnv();
      const { state, cookies } = await startLogin(env);
      const mock = mockDiscordFetch({ profile: PROFILE, ...fail });
      try {
        assertRefused(await callback(env, { state, cookies }), JSON.stringify(fail));
      } finally {
        mock.restore();
      }
      assert.equal(env.DB.query("SELECT COUNT(*) AS n FROM sessions")[0].n, 0);
    }
  });

  test("falha na revogação não bloqueia o login", async () => {
    const env = await makeEnv();
    const { state, cookies } = await startLogin(env);
    const mock = mockDiscordFetch({ profile: PROFILE, revokeStatus: 500 });
    let r;
    try {
      r = await callback(env, { state, cookies });
    } finally {
      mock.restore();
    }
    assert.equal(r.status, 302, r.text);
    assert.ok(cookieFrom(r.setCookies, "__Host-session"), "sessão deveria ser criada");
  });

  test("?next relativo é respeitado; next externo é ignorado (sem open redirect)", async () => {
    const cases = [
      ["/#/evento/12", "/#/evento/12"],
      ["https://evil.example/", "/"],
      ["//evil.example/x", "/"],
      ["/\\evil.example", "/"],
    ];
    for (const [next, expected] of cases) {
      const env = await makeEnv();
      const { state, cookies } = await startLogin(env, `?next=${encodeURIComponent(next)}`);
      const mock = mockDiscordFetch({ profile: PROFILE });
      let r;
      try {
        r = await callback(env, { state, cookies });
      } finally {
        mock.restore();
      }
      assert.equal(r.status, 302, r.text);
      const loc = new URL(r.location, BASE_URL);
      assert.equal(loc.origin, BASE_URL, `next=${next} redirecionou para ${r.location}`);
      assert.equal(loc.pathname + loc.search + loc.hash, expected, `next=${next}`);
    }
  });
});

describe("logs do OAuth não vazam segredos", { skip: !oauthReady && "rotas OAuth ausentes" }, () => {
  test("nenhum log contém Client Secret, code, state, tokens ou cookies", async () => {
    const logged = [];
    const orig = {};
    for (const k of ["log", "info", "warn", "error", "debug"]) {
      orig[k] = console[k];
      console[k] = (...a) => logged.push(a.map(String).join(" "));
    }
    const secrets = [CLIENT_SECRET, "codigo-de-teste", "access-token-falso", "refresh-token-falso"];
    try {
      for (const fail of [{}, { tokenStatus: 400 }, { meStatus: 401 }, { revokeStatus: 500 }]) {
        const env = await makeEnv();
        const { state, cookies } = await startLogin(env);
        secrets.push(state, ...cookies.map((c) => c.split("=")[1]));
        const mock = mockDiscordFetch({ profile: PROFILE, ...fail });
        try {
          const r = await callback(env, { state, cookies });
          const s = cookieFrom(r.setCookies, "__Host-session");
          if (s?.value) secrets.push(s.value);
          await callback(env, { state, cookies }); // reuso também gera log
        } finally {
          mock.restore();
        }
      }
    } finally {
      Object.assign(console, orig);
    }
    const leaks = logged.filter((l) => secrets.some((s) => s && l.includes(s)));
    assert.deepEqual(leaks, []);
  });
});
