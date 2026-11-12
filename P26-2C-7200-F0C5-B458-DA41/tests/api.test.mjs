// Testes de API contra o servidor local (wrangler pages dev + D1 local).
// Zero dependências: node:test + fetch nativo (Node 18+).
//
// Variáveis de ambiente:
//   BASE_URL       ex.: http://localhost:8788   (sem ela, todos os testes são pulados)
//   TOKEN_TECH     token (64 hex) de um usuário listado em ADMIN_DISCORD_IDS
//   TOKEN_AUTHOR   token de um usuário comum (autor dos chamados)
//   TOKEN_OTHER    token de outro usuário comum
//   TOKEN_SPAM     token de um usuário usado só no teste de limite por hora
//   TOKEN_POOL     (opcional) tokens extras separados por vírgula, usados para abrir chamados
//                  quando TOKEN_AUTHOR atinge o limite de 10/hora (rodar a suíte várias vezes)
//   TOKEN_LOGOUT   (opcional) token descartável, destruído pelo teste de logout
//   TOKEN_EXPIRED  (opcional) token cuja sessão já venceu
//   ID_AUTHOR      user_id do autor (para conferir o filtro mine=1)
//   BASE_URL_NO_MIGRATION (opcional) servidor com D1 sem migrações, para o teste de erro 500 limpo
//
// No D1 vai sessions.token_hash = SHA-256 hex do token; o cookie é it_session=<token>.
// Veja tests/RELATORIO-TESTES.md para o passo a passo de preparação.
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "").replace(/\/+$/, "");
const SKIP = BASE ? false : "BASE_URL não definida (suba `wrangler pages dev` e exporte BASE_URL para rodar)";
const T = {
  tech: process.env.TOKEN_TECH,
  author: process.env.TOKEN_AUTHOR,
  other: process.env.TOKEN_OTHER,
  spam: process.env.TOKEN_SPAM,
  logout: process.env.TOKEN_LOGOUT,
  expired: process.env.TOKEN_EXPIRED,
};
const ID_AUTHOR = process.env.ID_AUTHOR;
// (opcional) URL de um segundo `wrangler pages dev` apontando para um D1 SEM migrações
const BASE_NO_MIGRATION = (process.env.BASE_URL_NO_MIGRATION || "").replace(/\/+$/, "");
const CHAVE = "P26-2C-7200-F0C5-B458-DA41";
const CODE_RE = /^CH-[0-9A-HJKMNP-TV-Z]{6}$/;
const RUN = Date.now().toString(36); // marca única desta execução

async function call(path, { method = "GET", token, body, origin = true, headers = {}, raw } = {}) {
  const h = { Accept: "application/json", ...headers };
  if (token) h.Cookie = `it_session=${token}`;
  if (origin === true) h.Origin = BASE;
  else if (typeof origin === "string") h.Origin = origin;
  let payload;
  if (raw !== undefined) payload = raw;
  else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* não-JSON */ }
  return { status: res.status, headers: res.headers, data, text };
}

const ticketBody = (over = {}) => ({
  title: `Projetor do Lab 3 não liga ${RUN}`,
  location: "Laboratório 3",
  severity: "alta",
  description: "O projetor não acende desde ontem; já trocamos a tomada.",
  ...over,
});

// Chamados de teste são abertos por TOKEN_AUTHOR ou, quando ele bate no limite de 10/hora
// (rodar a suíte várias vezes na mesma hora), pelos tokens extras de TOKEN_POOL.
const POOL = [T.author, ...String(process.env.TOKEN_POOL || "").split(/[\s,]+/).filter(Boolean)];
async function openWith(token, over) {
  const r = await call("/api/tickets", { method: "POST", token, body: ticketBody(over) });
  assert.equal(r.status, 201, `abrir chamado: ${r.text}`);
  assert.match(r.data.code, CODE_RE);
  return r.data.code;
}
async function openTicket(over) {
  for (const token of POOL) {
    const r = await call("/api/tickets", { method: "POST", token, body: ticketBody(over) });
    if (r.status === 429) continue;
    assert.equal(r.status, 201, `abrir chamado: ${r.text}`);
    assert.match(r.data.code, CODE_RE);
    return { code: r.data.code, token };
  }
  assert.fail("TOKEN_AUTHOR e TOKEN_POOL atingiram o limite de 10 chamados/hora: adicione usuários em TOKEN_POOL.");
}
const move = (code, token, status, note) =>
  call(`/api/tickets/${code}/status`, { method: "POST", token, body: note === undefined ? { status } : { status, note } });
const getTicket = async (code, token = T.tech) => (await call(`/api/tickets/${code}`, { token })).data.ticket;

describe("API do Issue Tracker (wrangler + D1 local)", { skip: SKIP }, () => {
  before(() => {
    for (const k of ["tech", "author", "other", "spam"]) {
      assert.match(String(T[k]), /^[0-9a-f]{64}$/, `defina TOKEN_${k.toUpperCase()} (64 hex)`);
    }
  });

  describe("diagnóstico e página", () => {
    test("GET /api/status responde com a chave e D1 conectado", async () => {
      const r = await call("/api/status");
      assert.equal(r.status, 200);
      assert.equal(r.data.ok, true);
      assert.equal(r.data.chave, CHAVE);
      assert.equal(r.data.d1Connected, true);
      assert.equal(typeof r.data.totalTickets, "number");
    });

    test("GET /api/me sem cookie: user null + metadados", async () => {
      const r = await call("/api/me");
      assert.equal(r.status, 200);
      assert.equal(r.data.user, null);
      assert.equal(r.data.chave, CHAVE);
      assert.equal(r.data.d1Bound, true);
      assert.deepEqual(Object.keys(r.data.statuses), ["aberto", "em_analise", "aguardando", "resolvido"]);
      assert.ok(r.data.transitions && r.data.severities);
    });

    test("GET /api/me reconhece técnico (admin) e usuário comum", async () => {
      const tech = await call("/api/me", { token: T.tech });
      assert.equal(tech.data.user.admin, true);
      const author = await call("/api/me", { token: T.author });
      assert.equal(author.data.user.admin, false);
      if (ID_AUTHOR) assert.equal(author.data.user.user_id, ID_AUTHOR);
    });

    test("cookie malformado, desconhecido ou vencido = não logado", async () => {
      for (const token of ["abc", "z".repeat(64), "0".repeat(64), T.author.toUpperCase(), T.expired].filter(Boolean)) {
        const me = await call("/api/me", { token });
        assert.equal(me.data.user, null, token.slice(0, 8));
        assert.equal((await call("/api/tickets", { token })).status, 401);
      }
    });

    test("GET / serve o HTML com a chave no rodapé e os cabeçalhos de public/_headers", async () => {
      const r = await call("/", { headers: { Accept: "text/html" } });
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type"), /text\/html/);
      assert.match(r.text, /<footer[\s\S]*P26-2C-7200-F0C5-B458-DA41[\s\S]*<\/footer>/);
      const file = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
      const expected = file.split("\n").filter((l) => /^\s+\S+:/.test(l)).map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()];
      });
      assert.ok(expected.length >= 4);
      for (const [name, value] of expected) assert.equal(r.headers.get(name), value, name);
      const csp = r.headers.get("content-security-policy");
      assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    });

    test("index.html não tem script/estilo inline (compatível com a CSP)", async () => {
      const r = await call("/", { headers: { Accept: "text/html" } });
      assert.doesNotMatch(r.text, /<script(?![^>]*\bsrc=)[^>]*>/i);
      assert.doesNotMatch(r.text, /\sstyle=|\son[a-z]+=|<style/i);
    });
  });

  describe("arquivos de functions/_lib não viram rotas públicas", () => {
    for (const path of ["/_lib/rules.js", "/_lib/session.js", "/_lib/http.js", "/_lib/tickets.js",
      "/functions/_lib/rules.js", "/api/_lib/rules.js", "/_lib/rules", "/api/tickets/_lib/rules.js"]) {
      test(`GET ${path} não expõe código nem executa função`, async () => {
        const r = await call(path, { headers: { Accept: "*/*" } });
        assert.doesNotMatch(r.text, /export (async )?function|CODE_ALPHABET|sha256Hex|token_hash/);
        assert.doesNotMatch(r.headers.get("content-type") || "", /javascript/);
        assert.ok(!(r.data && r.data.ok === true), "não deve responder JSON de API");
      });
    }
    test("POST em /_lib/session.js não cria nada", async () => {
      const r = await call("/_lib/session.js", { method: "POST", token: T.author, body: {} });
      assert.ok(!(r.data && r.data.ok === true));
      assert.notEqual(r.status, 201);
    });
  });

  describe("login com Discord (sem credenciais reais)", () => {
    test("/api/auth/discord: erro tratado em JSON se não configurado, ou 302 para o Discord", async () => {
      const me = await call("/api/me");
      const r = await call("/api/auth/discord", { headers: { Accept: "*/*" } });
      if (me.data.discordConfigured) {
        assert.equal(r.status, 302);
        const loc = new URL(r.headers.get("location"));
        assert.equal(loc.host, "discord.com");
        assert.equal(loc.searchParams.get("scope"), "identify");
        assert.match(r.headers.get("set-cookie"), /it_oauth_state=[0-9a-f]{32};.*HttpOnly/);
      } else {
        assert.equal(r.status, 503, "falta de configuração = 503 (correção B)");
        assert.match(r.headers.get("content-type"), /application\/json/);
        assert.equal(r.data.ok, false);
        assert.match(r.data.error, /DISCORD_CLIENT_ID/);
      }
    });
    const cb = [
      ["", "missing_code"],
      ["?code=abc", "invalid_state"],
      ["?code=abc&state=x", "invalid_state"],
      ["?error=access_denied", "access_denied"],
    ];
    for (const [qs, reason] of cb) {
      test(`callback ${qs || "(sem parâmetros)"} → 302 /?auth_error=${reason}`, async () => {
        const r = await call(`/api/auth/discord/callback${qs}`, { headers: { Accept: "*/*", Cookie: "it_oauth_state=y" } });
        assert.equal(r.status, 302);
        const loc = new URL(r.headers.get("location"));
        assert.equal(loc.searchParams.get("auth_error"), reason);
        assert.match(r.headers.get("set-cookie") || "", /it_oauth_state=;.*Max-Age=0/);
      });
    }
    test("callback com state correto mas sem credenciais → oauth_not_configured (não 500)", async (t) => {
      const me = await call("/api/me");
      if (me.data.discordConfigured) return t.skip("Discord configurado neste servidor");
      const r = await call("/api/auth/discord/callback?code=abc&state=s1", { headers: { Accept: "*/*", Cookie: "it_oauth_state=s1" } });
      assert.equal(r.status, 302);
      assert.equal(new URL(r.headers.get("location")).searchParams.get("auth_error"), "oauth_not_configured");
    });
  });

  describe("casos obrigatórios da skill", () => {
    test("GET /api/tickets sem cookie → 401", async () => {
      const r = await call("/api/tickets");
      assert.equal(r.status, 401);
      assert.equal(r.data.ok, false);
    });

    test("POST /api/tickets sem header Origin → 403 (e nada é criado)", async () => {
      const before = (await call("/api/status")).data.totalTickets;
      const r = await call("/api/tickets", { method: "POST", token: T.author, origin: false, body: ticketBody() });
      assert.equal(r.status, 403);
      assert.equal((await call("/api/status")).data.totalTickets, before);
    });

    test("POST /api/tickets com Origin de outro site → 403", async () => {
      for (const origin of ["https://evil.example", "null", "http://localhost.evil.example"]) {
        const r = await call("/api/tickets", { method: "POST", token: T.author, origin, body: ticketBody() });
        assert.equal(r.status, 403, origin);
      }
    });

    test("POST /api/tickets com título de 2 letras → 422 + errors.title", async () => {
      const r = await call("/api/tickets", { method: "POST", token: T.author, body: ticketBody({ title: "ab" }) });
      assert.equal(r.status, 422);
      assert.ok(r.data.errors.title);
    });

    test("POST /api/tickets com severidade 'urgente' → 422 + errors.severity", async () => {
      const r = await call("/api/tickets", { method: "POST", token: T.author, body: ticketBody({ severity: "urgente" }) });
      assert.equal(r.status, 422);
      assert.ok(r.data.errors.severity);
    });

    test("POST /api/tickets válido → 201 + code CH-XXXXXX + evento 'criado'", async () => {
      const { code, token } = await openTicket();
      const t = await getTicket(code, token);
      assert.equal(t.code, code);
      assert.equal(t.status, "aberto");
      assert.equal(t.id, undefined, "id interno não deve vazar");
      assert.equal(t.events.length, 1);
      assert.equal(t.events[0].kind, "criado");
      assert.equal(t.events[0].to_status, "aberto");
      assert.deepEqual(t.permissions, { canComment: true, transitions: ["resolvido"] });
    });

    test("usuário comum (autor ou outro) move para em_analise → 403", async () => {
      const { code, token } = await openTicket();
      assert.equal((await move(code, token, "em_analise")).status, 403);
      assert.equal((await move(code, T.other, "em_analise")).status, 403);
      assert.equal((await move(code, T.other, "resolvido")).status, 403, "outro usuário não pode resolver");
      const t = await getTicket(code);
      assert.equal(t.status, "aberto");
      assert.equal(t.events.length, 1);
    });

    test("técnico move aberto → aguardando (pula etapa) → 409", async () => {
      const { code } = await openTicket();
      const r = await move(code, T.tech, "aguardando");
      assert.equal(r.status, 409);
      assert.equal((await getTicket(code)).events.length, 1);
    });

    test("técnico aberto → em_analise → aguardando → resolvido: 200 em cada passo e 4 eventos em ordem", async () => {
      const { code } = await openTicket();
      const steps = [["em_analise", undefined], ["aguardando", "Aguardando cabo HDMI novo"], ["resolvido", "Cabo trocado"]];
      for (const [to, note] of steps) {
        const r = await move(code, T.tech, to, note);
        assert.equal(r.status, 200, `${to}: ${r.text}`);
        assert.equal(r.data.ticket.status, to);
      }
      const t = await getTicket(code);
      assert.equal(t.events.length, 4);
      assert.deepEqual(t.events.map((e) => [e.kind, e.from_status, e.to_status, e.body]), [
        ["criado", null, "aberto", null],
        ["status", "aberto", "em_analise", null],
        ["status", "em_analise", "aguardando", "Aguardando cabo HDMI novo"],
        ["status", "aguardando", "resolvido", "Cabo trocado"],
      ]);
      for (let i = 1; i < t.events.length; i++) {
        assert.ok(t.events[i].id > t.events[i - 1].id);
        assert.ok(t.events[i].created_at >= t.events[i - 1].created_at);
      }
      assert.ok(t.resolved_at);
      assert.deepEqual(t.permissions, { canComment: false, transitions: [] });
      // estado final: nada mais muda
      for (const to of ["aberto", "em_analise", "aguardando", "resolvido"]) {
        assert.equal((await move(code, T.tech, to)).status, 409, to);
      }
      assert.equal((await getTicket(code)).events.length, 4);
    });

    test("comentar em chamado resolvido → 409 (e não grava)", async () => {
      const { code, token } = await openTicket();
      assert.equal((await move(code, token, "resolvido")).status, 200, "autor pode resolver o próprio chamado");
      const r = await call(`/api/tickets/${code}/comments`, { method: "POST", token: T.tech, body: { body: "Comentário tardio" } });
      assert.equal(r.status, 409);
      assert.equal((await getTicket(code)).events.length, 2);
    });

    test("GET /api/tickets/CH-ZZZZZZ → 404 (e códigos malformados também)", async () => {
      for (const c of ["CH-ZZZZZZ", "abc", "CH-IIIIII", "CH-ZZZZZZ%27%20OR%201=1--"]) {
        const r = await call(`/api/tickets/${c}`, { token: T.author });
        assert.equal(r.status, 404, c);
        assert.equal(r.data.ok, false);
      }
      assert.equal((await move("CH-ZZZZZZ", T.tech, "resolvido")).status, 404);
      assert.equal((await call("/api/tickets/CH-ZZZZZZ/comments", { method: "POST", token: T.tech, body: { body: "oi oi" } })).status, 404);
    });

    test("título com <script> é salvo como texto e devolvido intacto (sem escape duplo)", async () => {
      const title = `<script>alert(1)</script><img src=x onerror=alert(2)> ${RUN}`;
      const { code } = await openTicket({ title });
      const t = await getTicket(code);
      assert.equal(t.title, title);
      const list = await call(`/api/tickets?q=${encodeURIComponent(RUN)}`, { token: T.author });
      assert.ok(list.data.tickets.some((x) => x.title === title));
    });

    test("a UI nunca injeta HTML (app.js sem innerHTML/insertAdjacentHTML/document.write/eval)", () => {
      const js = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
      assert.doesNotMatch(js, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/);
      assert.match(js, /createTextNode|textContent/);
    });

    test("11º chamado na mesma hora → 429", async () => {
      const since = Date.now() - 3600 * 1000;
      const mine = await call("/api/tickets?mine=1", { token: T.spam });
      const recent = mine.data.tickets.filter((t) => Date.parse(t.created_at) > since).length;
      for (let i = recent; i < 10; i++) {
        const r = await call("/api/tickets", { method: "POST", token: T.spam, body: ticketBody({ title: `Spam ${i} ${RUN}` }) });
        assert.equal(r.status, 201, `chamado ${i + 1}`);
      }
      const r = await call("/api/tickets", { method: "POST", token: T.spam, body: ticketBody({ title: `Spam 11 ${RUN}` }) });
      assert.equal(r.status, 429);
      assert.equal(r.data.ok, false);
      // o limite é por usuário: outro usuário continua conseguindo abrir
      await openTicket({ severity: "baixa" });
    });
  });

  describe("entradas malformadas", () => {
    test("corpo não-JSON, JSON inválido, array e corpo enorme → 400", async () => {
      const cases = [
        { raw: "title=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        { raw: "{oops", headers: { "Content-Type": "application/json" } },
        { raw: "[1,2]", headers: { "Content-Type": "application/json" } },
        { raw: "null", headers: { "Content-Type": "application/json" } },
        { raw: JSON.stringify(ticketBody({ description: "x".repeat(20000) })), headers: { "Content-Type": "application/json" } },
      ];
      for (const c of cases) {
        const r = await call("/api/tickets", { method: "POST", token: T.author, ...c });
        assert.equal(r.status, 400, c.raw.slice(0, 20));
      }
    });
    test("campos extras (status, author_id) são ignorados", async () => {
      const { code, token } = await openTicket({ status: "resolvido", author_id: "1", code: "CH-000000" });
      const t = await getTicket(code);
      assert.equal(t.status, "aberto");
      assert.equal(t.author_id, (await call("/api/me", { token })).data.user.user_id);
      assert.notEqual(code, "CH-000000");
    });
    test("mudança de estado: destino inválido e observação longa → 422; sem Origin → 403", async () => {
      const { code } = await openTicket();
      let r = await move(code, T.tech, "fechado");
      assert.equal(r.status, 422);
      assert.ok(r.data.errors.status);
      r = await move(code, T.tech, "em_analise", "x".repeat(1001));
      assert.equal(r.status, 422);
      assert.ok(r.data.errors.note);
      r = await call(`/api/tickets/${code}/status`, { method: "POST", token: T.tech, origin: false, body: { status: "em_analise" } });
      assert.equal(r.status, 403);
      assert.equal((await getTicket(code)).status, "aberto");
    });
    test("comentário vazio → 422; sem Origin → 403; sem cookie → 401", async () => {
      const { code } = await openTicket();
      const path = `/api/tickets/${code}/comments`;
      let r = await call(path, { method: "POST", token: T.other, body: { body: "   " } });
      assert.equal(r.status, 422);
      assert.ok(r.data.errors.body);
      r = await call(path, { method: "POST", token: T.other, origin: false, body: { body: "Olá, tudo bem" } });
      assert.equal(r.status, 403);
      r = await call(path, { method: "POST", body: { body: "Olá, tudo bem" } });
      assert.equal(r.status, 401);
      assert.equal((await getTicket(code)).events.length, 1);
    });
    test("métodos não suportados não executam nada", async () => {
      for (const [method, path] of [["PUT", "/api/tickets"], ["DELETE", "/api/tickets/CH-ZZZZZZ"], ["PATCH", "/api/tickets"]]) {
        const r = await call(path, { method, token: T.tech, body: {} });
        assert.ok(r.status === 405 || r.status === 404, `${method} ${path} → ${r.status}`);
      }
    });
  });

  describe("linha do tempo com comentários e filtros da listagem", () => {
    let codeA; // autor, crítica, em análise, com comentário
    let tokenA; // quem abriu codeA
    let codeB; // outro, baixa, aberto
    const tag = `filtro${RUN}`;

    test("comentários entram na linha do tempo na ordem certa e contam na listagem", async () => {
      ({ code: codeA, token: tokenA } = await openTicket({ title: `PC 12 sem rede ${tag}`, severity: "critica" }));
      codeB = await openWith(T.other, { title: `Mouse quebrado ${tag}`, severity: "baixa", location: "Lab 5" });
      assert.equal((await move(codeA, T.tech, "em_analise")).status, 200);
      const c = await call(`/api/tickets/${codeA}/comments`, { method: "POST", token: T.other, body: { body: "Cabo de rede\r\nsolto" } });
      assert.equal(c.status, 201);
      const t = await getTicket(codeA);
      assert.deepEqual(t.events.map((e) => e.kind), ["criado", "status", "comentario"]);
      assert.equal(t.events[2].body, "Cabo de rede\nsolto");
      assert.equal(t.events[2].author_name, "other");
      const list = await call(`/api/tickets?q=${tag}`, { token: T.author });
      assert.equal(list.data.tickets.find((x) => x.code === codeA).comments, 1);
    });

    test("filtro q (título, local e código) e escape de curingas", async () => {
      let r = await call(`/api/tickets?q=${tag}`, { token: T.author });
      assert.deepEqual(r.data.tickets.map((x) => x.code).sort(), [codeA, codeB].sort());
      r = await call(`/api/tickets?q=${codeB.toLowerCase()}`, { token: T.author });
      assert.ok(r.data.tickets.some((x) => x.code === codeB));
      for (const wild of ["%", "_"]) {
        r = await call(`/api/tickets?q=${encodeURIComponent(wild)}`, { token: T.author });
        assert.equal(r.status, 200);
        for (const x of r.data.tickets) assert.ok(`${x.title} ${x.location} ${x.code}`.includes(wild), `curinga ${wild} não escapado`);
      }
    });

    test("filtros status, severity, mine e combinação", async () => {
      let r = await call(`/api/tickets?q=${tag}&severity=critica`, { token: T.author });
      assert.deepEqual(r.data.tickets.map((x) => x.code), [codeA]);
      r = await call(`/api/tickets?q=${tag}&status=aberto`, { token: T.author });
      assert.deepEqual(r.data.tickets.map((x) => x.code), [codeB]);
      r = await call(`/api/tickets?q=${tag}&mine=1`, { token: tokenA });
      assert.deepEqual(r.data.tickets.map((x) => x.code), [codeA]);
      r = await call("/api/tickets?status=resolvido", { token: T.author });
      assert.ok(r.data.tickets.length > 0);
      assert.ok(r.data.tickets.every((x) => x.status === "resolvido"));
      r = await call("/api/tickets?mine=1", { token: T.other });
      assert.ok(r.data.tickets.every((x) => x.author_name === "other"));
      const idA = (await call("/api/me", { token: tokenA })).data.user.user_id;
      r = await call("/api/tickets?mine=1", { token: tokenA });
      assert.ok(r.data.tickets.length > 0);
      assert.ok(r.data.tickets.every((x) => x.author_id === idA));
    });

    test("filtros desconhecidos são ignorados; totais por estado batem", async () => {
      const all = await call("/api/tickets", { token: T.author });
      const bogus = await call("/api/tickets?status=fechado&severity=urgente&mine=sim", { token: T.author });
      assert.equal(bogus.status, 200);
      assert.equal(bogus.data.tickets.length, all.data.tickets.length);
      const sum = Object.values(all.data.totals).reduce((a, b) => a + b, 0);
      assert.equal(sum, (await call("/api/status")).data.totalTickets);
    });

    test("ordenação: resolvidos por último; dentro dos abertos, crítica antes de baixa", async () => {
      const { tickets } = (await call("/api/tickets", { token: T.author })).data;
      const firstResolved = tickets.findIndex((x) => x.status === "resolvido");
      if (firstResolved >= 0) assert.ok(tickets.slice(firstResolved).every((x) => x.status === "resolvido"));
      const rank = { critica: 0, alta: 1, media: 2, baixa: 3 };
      const open = tickets.filter((x) => x.status !== "resolvido");
      for (let i = 1; i < open.length; i++) assert.ok(rank[open[i - 1].severity] <= rank[open[i].severity]);
    });
  });

  describe("changes() dentro do DB.batch em status.js", () => {
    test("UPDATE que afeta 1 linha grava exatamente 1 evento de status", async () => {
      const { code } = await openTicket();
      const r = await move(code, T.tech, "em_analise", "olhando");
      assert.equal(r.status, 200);
      const ev = r.data.ticket.events.filter((e) => e.kind === "status");
      assert.equal(ev.length, 1);
      assert.deepEqual([ev[0].from_status, ev[0].to_status, ev[0].body], ["aberto", "em_analise", "olhando"]);
    });

    test("requisições concorrentes: só uma vence e só ela grava evento", async (t) => {
      let raced = 0;
      for (let round = 0; round < 5; round++) {
        const { code } = await openTicket({ title: `Corrida ${round} ${RUN}` });
        const results = await Promise.all(Array.from({ length: 8 }, () => move(code, T.tech, "em_analise")));
        const ok = results.filter((r) => r.status === 200).length;
        const conflict = results.filter((r) => r.status === 409);
        raced += conflict.filter((r) => /outra pessoa/.test(r.data.error)).length;
        assert.equal(ok, 1, `rodada ${round}: ${results.map((r) => r.status)}`);
        assert.equal(conflict.length, 7);
        const tk = await getTicket(code);
        assert.equal(tk.events.filter((e) => e.kind === "status").length, 1, `rodada ${round}: evento duplicado`);
      }
      // informativo: quantas respostas passaram pela checagem de changes() (UPDATE com 0 linhas)
      t.diagnostic(`409 via changes()=0: ${raced}`);
    });

    test("transição inválida não chega ao banco (nenhum evento, updated_at igual)", async () => {
      const { code } = await openTicket();
      const before = await getTicket(code);
      assert.equal((await move(code, T.tech, "aguardando")).status, 409);
      const after = await getTicket(code);
      assert.equal(after.updated_at, before.updated_at);
      assert.equal(after.events.length, 1);
    });
  });

  describe("Rodada 2 — correções A–D do backend", () => {
    test("C: /api/rota-inexistente → 404 JSON (qualquer método, rotas aninhadas)", async () => {
      for (const [method, path] of [["GET", "/api/rota-inexistente"], ["POST", "/api/rota-inexistente"],
        ["GET", "/api/tickets/CH-ZZZZZZ/foo"], ["GET", "/api/auth/xyz"], ["GET", "/api/_lib/rules.js"]]) {
        const r = await call(path, { method, token: T.author, body: method === "POST" ? {} : undefined });
        assert.equal(r.status, 404, `${method} ${path}`);
        assert.match(r.headers.get("content-type"), /application\/json/);
        assert.equal(r.data.ok, false);
        assert.doesNotMatch(r.text, /<!DOCTYPE/i);
      }
    });

    test("C: o catch-all não engole as rotas reais", async () => {
      assert.equal((await call("/api/status")).status, 200);
      assert.equal((await call("/api/me")).status, 200);
      assert.equal((await call("/api/tickets")).status, 401);
      assert.equal((await call("/api/tickets", { token: T.author })).status, 200);
      assert.equal((await call("/api/auth/discord/callback", { headers: { Accept: "*/*" } })).status, 302);
      const page = await call("/", { headers: { Accept: "text/html" } });
      assert.equal(page.status, 200);
      assert.match(page.text, /P26-2C-7200-F0C5-B458-DA41/);
    });

    test("B: /api/auth/discord sem credenciais → 503 JSON", async (t) => {
      if ((await call("/api/me")).data.discordConfigured) return t.skip("Discord configurado neste servidor");
      const r = await call("/api/auth/discord", { headers: { Accept: "*/*" } });
      assert.equal(r.status, 503);
      assert.equal(r.data.ok, false);
      assert.match(r.data.error, /DISCORD_CLIENT_ID/);
    });

    test("D: cada chamado criado tem exatamente 1 evento 'criado' (inclusive em criações simultâneas)", async () => {
      const codes = [];
      for (const tok of POOL) {
        if (codes.length >= 4) break;
        const rs = await Promise.all([0, 1].map((i) =>
          call("/api/tickets", { method: "POST", token: tok, body: ticketBody({ title: `Atômico ${i} ${RUN}` }) })));
        for (const r of rs) {
          if (r.status === 429) continue;
          assert.equal(r.status, 201, r.text);
          codes.push(r.data.code);
        }
      }
      assert.ok(codes.length >= 2, "nenhum token disponível em TOKEN_AUTHOR/TOKEN_POOL");
      assert.equal(new Set(codes).size, codes.length);
      for (const code of codes) {
        const t = await getTicket(code);
        const criados = t.events.filter((e) => e.kind === "criado");
        assert.equal(t.events.length, 1, code);
        assert.equal(criados.length, 1, code);
        assert.equal(criados[0].to_status, "aberto");
        assert.equal(criados[0].author_id, t.author_id);
      }
    });

    test("D: criação rejeitada (422/403/429) não deixa chamado nem evento órfão", async () => {
      const before = (await call("/api/status")).data.totalTickets;
      await call("/api/tickets", { method: "POST", token: T.author, body: ticketBody({ title: "ab" }) });
      await call("/api/tickets", { method: "POST", token: T.author, origin: false, body: ticketBody() });
      await call("/api/tickets", { method: "POST", token: T.spam, body: ticketBody() }); // spam já está no limite
      assert.equal((await call("/api/status")).data.totalTickets, before);
    });

    test("A: D1 sem migrações → 500 JSON limpo, sem stack trace", { skip: BASE_NO_MIGRATION ? false : "BASE_URL_NO_MIGRATION não definida" }, async () => {
      const cookie = `it_session=${"a".repeat(64)}`; // formato válido força a consulta à tabela sessions
      for (const [method, path] of [["GET", "/api/tickets"], ["GET", "/api/tickets/CH-ZZZZZZ"], ["POST", "/api/tickets"]]) {
        const res = await fetch(BASE_NO_MIGRATION + path, {
          method,
          headers: { Cookie: cookie, Origin: BASE_NO_MIGRATION, "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify(ticketBody()) : undefined,
        });
        const text = await res.text();
        assert.equal(res.status, 500, `${method} ${path}`);
        assert.match(res.headers.get("content-type"), /application\/json/);
        const data = JSON.parse(text);
        assert.equal(data.ok, false);
        assert.match(data.error, /migrations apply/);
        assert.doesNotMatch(text, /\bat\s+\S+\s*\(|D1_ERROR|SQLITE|node_modules|cloudflare-internal|\.js:\d+/);
      }
      // rotas que já tratavam o erro continuam respondendo
      assert.equal((await fetch(BASE_NO_MIGRATION + "/api/me", { headers: { Cookie: cookie } })).status, 200);
      assert.equal((await fetch(BASE_NO_MIGRATION + "/api/status")).status, 200);
    });
  });

  describe("logout", () => {
    test("POST /api/auth/logout sem Origin → 403", async () => {
      const r = await call("/api/auth/logout", { method: "POST", token: T.author, origin: false });
      assert.equal(r.status, 403);
      assert.ok((await call("/api/me", { token: T.author })).data.user, "sessão continua válida");
    });
    test("logout apaga a sessão no D1 e o cookie", async (t) => {
      if (!T.logout) return t.skip("TOKEN_LOGOUT não definido");
      if (!(await call("/api/me", { token: T.logout })).data.user) return t.skip("TOKEN_LOGOUT já foi usado (sessão destruída em execução anterior)");
      const r = await call("/api/auth/logout", { method: "POST", token: T.logout });
      assert.equal(r.status, 200);
      assert.match(r.headers.get("set-cookie"), /it_session=;.*Max-Age=0/);
      assert.equal((await call("/api/me", { token: T.logout })).data.user, null);
      assert.equal((await call("/api/tickets", { token: T.logout })).status, 401);
    });
  });
});
