// Testes de integração da API contra o servidor local (wrangler pages dev + D1 local).
// Executar: node --test tests/api.test.mjs   (zero dependências; ver tests/README.md)
// Usuários e sessões são criados direto no D1 local (SHA-256 do token), como no OAuth real.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
//
// Variáveis de ambiente:
//   BASE_URL        servidor sem variáveis do Discord (padrão http://localhost:8788)
//   OAUTH_BASE_URL  servidor com DISCORD_CLIENT_ID/SECRET falsos (padrão http://localhost:8789;
//                   se não responder, os testes que dependem dele são pulados)
//   WRANGLER        comando do wrangler (padrão "npx wrangler")
//   PERSIST_TO      mesma pasta passada a --persist-to no pages dev (opcional)
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const OAUTH_BASE = (process.env.OAUTH_BASE_URL || "http://localhost:8789").replace(/\/$/, "");
const WRANGLER = process.env.WRANGLER || "npx wrangler";
const PERSIST = process.env.PERSIST_TO ? ["--persist-to", process.env.PERSIST_TO] : [];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- Acesso ao D1 local ----------

function sql(command) {
  // execFileSync com lista de argumentos: o SQL não passa pelo shell.
  const [bin, ...pre] = WRANGLER.split(" ").filter(Boolean);
  const out = execFileSync(
    bin,
    [...pre, "d1", "execute", "DB", "--local", ...PERSIST, "--json", "--command", command],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } }
  );
  const json = JSON.parse(out.slice(out.indexOf("[")));
  return json.flatMap((r) => r.results || []);
}

const RUN = Date.now().toString().slice(-9) + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const uid = (n) => `7${RUN}${String(n).padStart(3, "0")}`; // snowflake fictício e único por execução
const newToken = () => randomBytes(32).toString("hex");
const sha = (t) => createHash("sha256").update(t).digest("hex");

const users = {
  ana: { id: uid(1), token: newToken() },
  bia: { id: uid(2), token: newToken() },
  caio: { id: uid(3), token: newToken() },     // sessão expirada
  duda: { id: uid(4), token: newToken() },     // logout
};

// ---------- HTTP ----------

async function call(method, path, { user, body, headers = {}, raw, base = BASE } = {}) {
  const h = { ...headers };
  if (user) h.Cookie = `sessao=${user.token}`;
  let payload;
  if (raw !== undefined) payload = raw;
  else if (body !== undefined) {
    payload = JSON.stringify(body);
    if (!("Content-Type" in h)) h["Content-Type"] = "application/json";
  }
  const res = await fetch(base + path, { method, headers: h, body: payload, redirect: "manual" });
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { /* sem JSON */ }
  return { status: res.status, data, headers: res.headers };
}

const inOneDay = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();
async function createPoll(user, extra = {}) {
  const r = await call("POST", "/api/polls", {
    user,
    body: { title: "Enquete de teste " + RUN, description: "", closes_at: inOneDay(), options: ["Azul", "Verde", "Roxo"], ...extra },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.poll;
}

function assertErro(r, status, code) {
  assert.equal(r.status, status, JSON.stringify(r.data));
  assert.equal(r.data?.ok, false);
  assert.equal(r.data?.error, code);
  assert.equal(typeof r.data?.message, "string");
}

// ---------- Preparação ----------

before(async () => {
  const st = await fetch(BASE + "/api/status").catch(() => null);
  assert.ok(st && st.ok, `Servidor não responde em ${BASE}. Rode wrangler pages dev public --port 8788.`);
  const exp = Date.now() + 3600 * 1000;
  const stmts = [];
  for (const [name, u] of Object.entries(users)) {
    stmts.push(`INSERT INTO users (user_id, username, avatar_url) VALUES ('${u.id}', 'Teste ${name}', 'https://cdn.discordapp.com/embed/avatars/0.png')`);
    const expiresAt = name === "caio" ? Date.now() - 1000 : exp;
    stmts.push(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('${sha(u.token)}', '${u.id}', ${expiresAt})`);
  }
  sql(stmts.join("; ") + ";");
});

// ---------- Casos ----------

describe("status e autenticação básica", () => {
  test("GET /api/status é público e traz a chave", async () => {
    const r = await call("GET", "/api/status");
    assert.equal(r.status, 200);
    assert.equal(r.data.chave, "P26-2A-0FC2-F5F9-5A1B-0D19");
    assert.equal(r.data.d1Connected, true);
  });

  test("sem cookie: /api/polls, /api/polls/:id e /api/me retornam 401", async () => {
    assertErro(await call("GET", "/api/polls"), 401, "nao_autenticado");
    assertErro(await call("GET", "/api/polls/1"), 401, "nao_autenticado");
    assertErro(await call("POST", "/api/polls", { body: { title: "abc" } }), 401, "nao_autenticado");
    assertErro(await call("POST", "/api/polls/1/vote", { body: { option_id: 1 } }), 401, "nao_autenticado");
    assertErro(await call("GET", "/api/me"), 401, "nao_autenticado");
  });

  test("cookie com token desconhecido ou malformado: 401", async () => {
    assertErro(await call("GET", "/api/me", { user: { token: newToken() } }), 401, "nao_autenticado");
    assertErro(await call("GET", "/api/me", { user: { token: "' OR 1=1 --" } }), 401, "nao_autenticado");
  });

  test("GET /api/me com sessão válida devolve o usuário", async () => {
    const r = await call("GET", "/api/me", { user: users.ana });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.user_id, users.ana.id);
    assert.equal(r.data.user.username, "Teste ana");
  });

  test("sessão expirada: 401 e a sessão é apagada do D1", async () => {
    assertErro(await call("GET", "/api/me", { user: users.caio }), 401, "nao_autenticado");
    assertErro(await call("GET", "/api/polls", { user: users.caio }), 401, "nao_autenticado");
    const rows = sql(`SELECT COUNT(*) AS n FROM sessions WHERE token_hash = '${sha(users.caio.token)}'`);
    assert.equal(rows[0].n, 0);
  });

  test("logout apaga a sessão e expira o cookie", async () => {
    assert.equal((await call("GET", "/api/me", { user: users.duda })).status, 200);
    const r = await call("POST", "/api/auth/logout", { user: users.duda, body: {} });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie") || "", /sessao=;.*Max-Age=0/);
    assertErro(await call("GET", "/api/me", { user: users.duda }), 401, "nao_autenticado");
  });

  test("método não suportado: 405", async () => {
    assert.equal((await call("DELETE", "/api/polls", { user: users.ana })).status, 405);
  });
});

describe("criação de enquete", () => {
  test("enquete válida: 201 com id e opções", async () => {
    const r = await call("POST", "/api/polls", {
      user: users.ana,
      body: { title: "  Melhor linguagem?  ", description: "x", closes_at: inOneDay(), options: ["JS", "Python"] },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.ok, true);
    assert.ok(Number.isInteger(r.data.poll.id));
    assert.equal(r.data.poll.title, "Melhor linguagem?");
    assert.deepEqual(r.data.poll.options.map((o) => o.label), ["JS", "Python"]);
  });

  const invalidos = {
    "título curto": { title: "ab" },
    "1 opção": { options: ["Só"] },
    "11 opções": { options: Array.from({ length: 11 }, (_, i) => "Op " + i) },
    "opções repetidas": { options: ["Sim", "SIM"] },
    "prazo no passado": { closes_at: new Date(Date.now() - 60000).toISOString() },
    "prazo em 1 minuto": { closes_at: new Date(Date.now() + 60000).toISOString() },
    "prazo acima de 365 dias": { closes_at: new Date(Date.now() + 400 * 86400000).toISOString() },
    "data inválida": { closes_at: "ontem" },
    "descrição longa": { description: "d".repeat(1001) },
  };
  for (const [nome, extra] of Object.entries(invalidos)) {
    test(`inválida (${nome}): 400 dados_invalidos`, async () => {
      const r = await call("POST", "/api/polls", {
        user: users.ana,
        body: { title: "Título válido", description: "", closes_at: inOneDay(), options: ["A", "B"], ...extra },
      });
      assertErro(r, 400, "dados_invalidos");
    });
  }

  test("corpo que não é JSON ou Content-Type errado: 400", async () => {
    assertErro(await call("POST", "/api/polls", { user: users.ana, raw: "{quebrado", headers: { "Content-Type": "application/json" } }), 400, "dados_invalidos");
    assertErro(await call("POST", "/api/polls", { user: users.ana, raw: "title=abc", headers: { "Content-Type": "application/x-www-form-urlencoded" } }), 400, "dados_invalidos");
  });

  test("creator_id no corpo é ignorado (criador vem da sessão)", async () => {
    const p = await createPoll(users.bia, { creator_id: users.ana.id, user_id: users.ana.id });
    const rows = sql(`SELECT creator_id FROM polls WHERE id = ${p.id}`);
    assert.equal(rows[0].creator_id, users.bia.id);
  });
});

describe("Origin (anti-CSRF)", () => {
  test("POST com Origin estranho: 403 em criar, votar e logout", async () => {
    const evil = { Origin: "https://evil.example.com" };
    assertErro(await call("POST", "/api/polls", { user: users.ana, headers: evil, body: { title: "abc" } }), 403, "origem_invalida");
    assertErro(await call("POST", "/api/polls/1/vote", { user: users.ana, headers: evil, body: { option_id: 1 } }), 403, "origem_invalida");
    assertErro(await call("POST", "/api/auth/logout", { user: users.ana, headers: evil, body: {} }), 403, "origem_invalida");
    // a sessão continua válida após o logout bloqueado
    assert.equal((await call("GET", "/api/me", { user: users.ana })).status, 200);
  });

  test("POST com Origin igual à origem do servidor é aceito", async () => {
    const r = await call("POST", "/api/polls", {
      user: users.ana,
      headers: { Origin: BASE },
      body: { title: "Origem correta", closes_at: inOneDay(), options: ["A", "B"] },
    });
    assert.equal(r.status, 201);
  });
});

describe("detalhe e votação", () => {
  let poll;
  before(async () => { poll = await createPoll(users.ana); });

  test("detalhe antes de votar: results === null", async () => {
    const r = await call("GET", `/api/polls/${poll.id}`, { user: users.ana });
    assert.equal(r.status, 200);
    assert.equal(r.data.poll.results, null);
    assert.equal(r.data.poll.has_voted, false);
    assert.equal(r.data.poll.my_option_id, null);
    assert.equal(r.data.poll.is_open, true);
    assert.equal(r.data.poll.options.length, 3);
    assert.equal(typeof r.data.server_now, "number");
  });

  test("votar: 201 com barras; votar de novo: 409", async () => {
    const opt = poll.options[1].id;
    const r = await call("POST", `/api/polls/${poll.id}/vote`, { user: users.ana, body: { option_id: opt } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.my_option_id, opt);
    assert.equal(r.data.results.total_votes, 1);
    const minha = r.data.results.options.find((o) => o.id === opt);
    assert.equal(minha.votes, 1);
    assert.equal(minha.percent, 100);

    assertErro(await call("POST", `/api/polls/${poll.id}/vote`, { user: users.ana, body: { option_id: poll.options[0].id } }), 409, "voto_duplicado");

    const d = await call("GET", `/api/polls/${poll.id}`, { user: users.ana });
    assert.equal(d.data.poll.has_voted, true);
    assert.equal(d.data.poll.my_option_id, opt);
    assert.equal(d.data.poll.results.total_votes, 1);
  });

  test("outro usuário que não votou continua sem ver o parcial", async () => {
    const d = await call("GET", `/api/polls/${poll.id}`, { user: users.bia });
    assert.equal(d.data.poll.results, null);
  });

  test("lista mostra has_voted e total_votes", async () => {
    const r = await call("GET", "/api/polls", { user: users.ana });
    assert.equal(r.status, 200);
    const item = r.data.polls.find((p) => p.id === poll.id);
    assert.equal(item.has_voted, true);
    assert.equal(item.total_votes, 1);
    assert.equal(item.option_count, 3);
    assert.equal(item.is_open, true);
  });

  test("opção de outra enquete: 400 opcao_invalida", async () => {
    const outra = await createPoll(users.ana);
    assertErro(await call("POST", `/api/polls/${poll.id}/vote`, { user: users.bia, body: { option_id: outra.options[0].id } }), 400, "opcao_invalida");
    assertErro(await call("POST", `/api/polls/${poll.id}/vote`, { user: users.bia, body: { option_id: "1" } }), 400, "opcao_invalida");
    assertErro(await call("POST", `/api/polls/${poll.id}/vote`, { user: users.bia, body: {} }), 400, "opcao_invalida");
  });

  test("enquete inexistente: 404 no detalhe e no voto", async () => {
    assertErro(await call("GET", "/api/polls/999999999", { user: users.ana }), 404, "enquete_nao_encontrada");
    assertErro(await call("GET", "/api/polls/abc", { user: users.ana }), 404, "enquete_nao_encontrada");
    assertErro(await call("POST", "/api/polls/999999999/vote", { user: users.ana, body: { option_id: 1 } }), 404, "enquete_nao_encontrada");
  });

  test("user_id no corpo é ignorado: o voto conta para o dono da sessão", async () => {
    const p = await createPoll(users.ana);
    const r = await call("POST", `/api/polls/${p.id}/vote`, {
      user: users.bia,
      body: { option_id: p.options[0].id, user_id: users.ana.id },
    });
    assert.equal(r.status, 201);
    const rows = sql(`SELECT user_id FROM votes WHERE poll_id = ${p.id}`);
    assert.deepEqual(rows.map((x) => x.user_id), [users.bia.id]);
    // Ana continua podendo votar (o voto não foi atribuído a ela)
    const d = await call("GET", `/api/polls/${p.id}`, { user: users.ana });
    assert.equal(d.data.poll.has_voted, false);
    assert.equal((await call("POST", `/api/polls/${p.id}/vote`, { user: users.ana, body: { option_id: p.options[1].id } })).status, 201);
  });

  test("duas requisições de voto simultâneas do mesmo usuário: exatamente uma 201", async () => {
    for (let rodada = 0; rodada < 3; rodada++) {
      const p = await createPoll(users.ana);
      const reqs = [0, 1, 2, 1, 0].map((i) =>
        call("POST", `/api/polls/${p.id}/vote`, { user: users.bia, body: { option_id: p.options[i].id } }));
      const st = (await Promise.all(reqs)).map((r) => r.status).sort();
      assert.deepEqual(st, [201, 409, 409, 409, 409], `rodada ${rodada}: ${st}`);
      const rows = sql(`SELECT COUNT(*) AS n FROM votes WHERE poll_id = ${p.id} AND user_id = '${users.bia.id}'`);
      assert.equal(rows[0].n, 1);
    }
  });

  test("exatamente duas requisições simultâneas: uma 201 e uma 409", async () => {
    const p = await createPoll(users.ana);
    const [a, b] = await Promise.all([
      call("POST", `/api/polls/${p.id}/vote`, { user: users.ana, body: { option_id: p.options[0].id } }),
      call("POST", `/api/polls/${p.id}/vote`, { user: users.ana, body: { option_id: p.options[1].id } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  });
});

describe("enquete encerrada (prazo ajustado no D1)", () => {
  let poll;
  before(async () => {
    poll = await createPoll(users.ana);
    // Um voto antes de encerrar, para os resultados terem conteúdo.
    assert.equal((await call("POST", `/api/polls/${poll.id}/vote`, { user: users.ana, body: { option_id: poll.options[2].id } })).status, 201);
    sql(`UPDATE polls SET closes_at = ${Date.now() - 60000} WHERE id = ${poll.id}`);
  });

  test("votar em enquete vencida: 403 enquete_encerrada", async () => {
    assertErro(await call("POST", `/api/polls/${poll.id}/vote`, { user: users.bia, body: { option_id: poll.options[0].id } }), 403, "enquete_encerrada");
    // ordem do SPEC: prazo (403) é verificado antes da opção (400)
    assertErro(await call("POST", `/api/polls/${poll.id}/vote`, { user: users.bia, body: { option_id: 0 } }), 403, "enquete_encerrada");
    const rows = sql(`SELECT COUNT(*) AS n FROM votes WHERE poll_id = ${poll.id}`);
    assert.equal(rows[0].n, 1);
  });

  test("quem não votou vê os resultados finais", async () => {
    const d = await call("GET", `/api/polls/${poll.id}`, { user: users.bia });
    assert.equal(d.status, 200);
    assert.equal(d.data.poll.is_open, false);
    assert.equal(d.data.poll.has_voted, false);
    assert.notEqual(d.data.poll.results, null);
    assert.equal(d.data.poll.results.total_votes, 1);
    assert.equal(d.data.poll.results.options[2].percent, 100);
  });

  test("lista: abertas antes das encerradas", async () => {
    const r = await call("GET", "/api/polls", { user: users.bia });
    const flags = r.data.polls.map((p) => p.is_open);
    const primeiraFechada = flags.indexOf(false);
    assert.ok(primeiraFechada >= 0);
    assert.ok(flags.slice(primeiraFechada).every((x) => x === false), "há enquete aberta depois de uma encerrada");
    const abertas = r.data.polls.filter((p) => p.is_open).map((p) => p.closes_at);
    assert.deepEqual(abertas, [...abertas].sort((a, b) => a - b));
    const fechadas = r.data.polls.filter((p) => !p.is_open).map((p) => p.closes_at);
    assert.deepEqual(fechadas, [...fechadas].sort((a, b) => b - a));
  });
});

describe("OAuth do Discord", () => {
  test("sem variáveis: /api/auth/discord responde 500 oauth_not_configured", async () => {
    assertErro(await call("GET", "/api/auth/discord"), 500, "oauth_not_configured");
  });

  test("sem variáveis: callback redireciona com ?erro=oauth_not_configured", async () => {
    const r = await call("GET", "/api/auth/discord/callback?code=x&state=y");
    assert.equal(r.status, 302);
    assert.equal(new URL(r.headers.get("location"), BASE).search, "?erro=oauth_not_configured");
  });

  let oauthUp = false;
  before(async () => {
    const st = await fetch(OAUTH_BASE + "/api/status").then((r) => r.json()).catch(() => null);
    oauthUp = Boolean(st && st.discordOAuthConfigured);
  });

  test("com DISCORD_CLIENT_ID falso: 302 para discord.com com state e cookie oauth_state", async (t) => {
    if (!oauthUp) return t.skip(`servidor com OAuth falso não disponível em ${OAUTH_BASE}`);
    const r = await call("GET", "/api/auth/discord", { base: OAUTH_BASE });
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get("location"));
    assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
    assert.equal(loc.searchParams.get("response_type"), "code");
    assert.equal(loc.searchParams.get("scope"), "identify");
    assert.equal(loc.searchParams.get("redirect_uri"), OAUTH_BASE + "/api/auth/discord/callback");
    assert.ok(loc.searchParams.get("client_id"));
    const state = loc.searchParams.get("state");
    assert.match(state, /^[0-9a-f]{64}$/);
    const sc = r.headers.get("set-cookie") || "";
    assert.ok(sc.includes(`oauth_state=${state}`), sc);
    assert.match(sc, /HttpOnly/);
    assert.match(sc, /SameSite=Lax/);
    assert.match(sc, /Max-Age=600/);
  });

  test("callback com state errado ou ausente: redireciona para /?erro=state_invalido", async (t) => {
    if (!oauthUp) return t.skip(`servidor com OAuth falso não disponível em ${OAUTH_BASE}`);
    const casos = [
      { path: "/api/auth/discord/callback?code=abc&state=errado", cookie: "oauth_state=" + "a".repeat(64) },
      { path: "/api/auth/discord/callback?code=abc&state=" + "a".repeat(64), cookie: "" },
      { path: "/api/auth/discord/callback?code=abc", cookie: "oauth_state=" + "a".repeat(64) },
    ];
    for (const c of casos) {
      const r = await call("GET", c.path, { base: OAUTH_BASE, headers: c.cookie ? { Cookie: c.cookie } : {} });
      assert.equal(r.status, 302, c.path);
      const loc = new URL(r.headers.get("location"), OAUTH_BASE);
      assert.equal(loc.pathname + loc.search, "/?erro=state_invalido");
      assert.match(r.headers.get("set-cookie") || "", /oauth_state=;.*Max-Age=0/);
    }
  });

  test("callback com error=access_denied: /?erro=acesso_negado", async (t) => {
    if (!oauthUp) return t.skip(`servidor com OAuth falso não disponível em ${OAUTH_BASE}`);
    const r = await call("GET", "/api/auth/discord/callback?error=access_denied", { base: OAUTH_BASE });
    assert.equal(r.status, 302);
    assert.equal(new URL(r.headers.get("location"), OAUTH_BASE).search, "?erro=acesso_negado");
  });
});
