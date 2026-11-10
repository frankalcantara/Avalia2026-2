// Teste de API contra servidor rodando (wrangler pages dev ou deploy).
// Uso:
//   BASE_URL=http://localhost:8788 SID_A=<token A> SID_B=<token B> node --test tests/api.test.mjs
// Sem SID_A/SID_B só roda a parte não autenticada (serve para produção).
// As sessões A e B precisam existir em `sessions` (ver docs/RELATORIO-TESTES.md). O teste apaga o que cria.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { calcular } from "../public/js/calculo.js";

// Sem BASE_URL o arquivo inteiro é pulado (npm test continua verde sem servidor).
const t = process.env.BASE_URL ? test : test.skip;
const BASE = (process.env.BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const SID_A = process.env.SID_A;
const SID_B = process.env.SID_B;
const semSessao = !SID_A || !SID_B ? "SID_A/SID_B não definidos" : false;

async function req(method, path, { sid, body, raw, cookie } = {}) {
  const headers = {};
  if (sid) headers.cookie = `sid=${sid}`;
  if (cookie) headers.cookie = cookie;
  if (body !== undefined || raw !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, {
    method, headers, redirect: "manual",
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* sem corpo JSON */ }
  return { status: res.status, json, headers: res.headers };
}

const valida = () => ({
  nome: "Teste API", notaMax: 10, mediaAprovacao: 7, mediaExame: 4, mediaFinal: 5,
  avaliacoes: [
    { nome: "P1", tipo: "prova", peso: 4, nota: 6 },
    { nome: "P2", tipo: "prova", peso: 4, nota: null },
    { nome: "Lista", tipo: "lista", peso: 2, nota: 10 },
  ],
});

const criadas = []; // [sid, id]
async function criar(sid, body = valida()) {
  const r = await req("POST", "/api/disciplinas", { sid, body });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  criadas.push([sid, r.json.disciplina.id]);
  return r.json.disciplina;
}
after(async () => {
  for (const [sid, id] of criadas) await req("DELETE", `/api/disciplinas/${id}`, { sid }).catch(() => {});
});

/* ---------- sem autenticação ---------- */

t("401 sem cookie em todas as rotas de dados", async () => {
  for (const [m, p] of [["GET", "/api/me"], ["GET", "/api/disciplinas"], ["POST", "/api/disciplinas"],
    ["PUT", "/api/disciplinas/1"], ["DELETE", "/api/disciplinas/1"]]) {
    const r = await req(m, p, m === "POST" || m === "PUT" ? { body: valida() } : {});
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.deepEqual(r.json, { erro: "nao_autenticado" });
  }
});

t("401 com cookie forjado, aleatório, SQL injection ou user_id no lugar do token", async () => {
  for (const sid of ["forjado", "a".repeat(64), "' OR '1'='1", "test-user-a", "tok-teste-expirado"]) {
    const r = await req("GET", "/api/disciplinas", { cookie: `sid=${encodeURIComponent(sid)}` });
    assert.equal(r.status, 401, sid);
  }
});

t("cookie sid com escape percentual malformado deve dar 401 (não 500)", async () => {
  const r = await req("GET", "/api/me", { cookie: "sid=%E0%A4%A" });
  assert.equal(r.status, 401);
});

t("GET /api/auth/discord redireciona (302) com state e cookie oauth_state", async () => {
  const r = await req("GET", "/api/auth/discord");
  assert.equal(r.status, 302);
  const loc = r.headers.get("location") || "";
  if (loc.includes("discord.com")) {
    const u = new URL(loc);
    assert.match(u.searchParams.get("state") || "", /^[0-9a-f]{32}$/);
    assert.equal(u.searchParams.get("scope"), "identify");
    assert.match(r.headers.get("set-cookie") || "", /oauth_state=[0-9a-f]{32};.*HttpOnly/i);
  } else {
    assert.match(loc, /auth_error=discord_nao_configurado/); // ambiente local sem segredo
  }
});

t("callback rejeita state ausente/divergente", async () => {
  const r = await req("GET", "/api/auth/discord/callback?code=x&state=abc", { cookie: "oauth_state=outro" });
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /auth_error=state_invalido/);
});

/* ---------- autenticado ---------- */

t("GET /api/me devolve o usuário da sessão", { skip: semSessao }, async () => {
  const r = await req("GET", "/api/me", { sid: SID_A });
  assert.equal(r.status, 200);
  assert.ok(r.json.user.userId);
  assert.ok("username" in r.json.user && "avatar" in r.json.user);
});

t("400 para payloads inválidos (POST e PUT)", { skip: semSessao }, async () => {
  const d = await criar(SID_A);
  const av = (o) => ({ nome: "P", tipo: "prova", peso: 1, nota: null, ...o });
  const casos = {
    "nome vazio": { ...valida(), nome: "" },
    "nome só espaços": { ...valida(), nome: "   " },
    "nome > 80": { ...valida(), nome: "x".repeat(81) },
    "peso 0": { ...valida(), avaliacoes: [av({ peso: 0 })] },
    "peso negativo": { ...valida(), avaliacoes: [av({ peso: -2 })] },
    "peso texto": { ...valida(), avaliacoes: [av({ peso: "abc" })] },
    "nota > notaMax": { ...valida(), avaliacoes: [av({ nota: 10.5 })] },
    "nota negativa": { ...valida(), avaliacoes: [av({ nota: -1 })] },
    "tipo inválido": { ...valida(), avaliacoes: [av({ tipo: "quiz" })] },
    "0 avaliações": { ...valida(), avaliacoes: [] },
    "31 avaliações": { ...valida(), avaliacoes: Array.from({ length: 31 }, (_, i) => av({ nome: `A${i}` })) },
    "avaliacoes não-array": { ...valida(), avaliacoes: { 0: av() } },
    "mediaExame > mediaAprovacao": { ...valida(), mediaExame: 8 },
    "mediaAprovacao > notaMax": { ...valida(), mediaAprovacao: 11 },
    "notaMax 0": { ...valida(), notaMax: 0 },
  };
  for (const [nome, body] of Object.entries(casos)) {
    const p = await req("POST", "/api/disciplinas", { sid: SID_A, body });
    assert.equal(p.status, 400, `POST ${nome}: ${JSON.stringify(p.json)}`);
    assert.equal(typeof p.json?.erro, "string", nome);
    const u = await req("PUT", `/api/disciplinas/${d.id}`, { sid: SID_A, body });
    assert.equal(u.status, 400, `PUT ${nome}`);
  }
  for (const raw of ["{nao json", "null", "[]", '"texto"']) {
    assert.equal((await req("POST", "/api/disciplinas", { sid: SID_A, raw })).status, 400, raw);
  }
  // nada foi alterado pelos PUT inválidos
  const lista = (await req("GET", "/api/disciplinas", { sid: SID_A })).json.disciplinas;
  assert.equal(lista.find((x) => x.id === d.id).nome, "Teste API");
});

t("400 para :id não numérico / não positivo", { skip: semSessao }, async () => {
  for (const id of ["abc", "0", "-1", "1.5", "01", "1e3", "%20"]) {
    assert.equal((await req("PUT", `/api/disciplinas/${id}`, { sid: SID_A, body: valida() })).status, 400, `PUT ${id}`);
    assert.equal((await req("DELETE", `/api/disciplinas/${id}`, { sid: SID_A })).status, 400, `DELETE ${id}`);
  }
  // inteiro enorme válido no formato, inexistente → 404
  assert.equal((await req("DELETE", "/api/disciplinas/9999999999999999", { sid: SID_A })).status, 404);
  assert.equal((await req("PUT", "/api/disciplinas/999999999", { sid: SID_A, body: valida() })).status, 404);
});

t("isolamento: B não vê, não edita e não apaga disciplina de A", { skip: semSessao }, async () => {
  const d = await criar(SID_A, { ...valida(), nome: "Segredo de A" });
  const listaB = (await req("GET", "/api/disciplinas", { sid: SID_B })).json.disciplinas;
  assert.ok(!listaB.some((x) => x.id === d.id || x.nome === "Segredo de A"), "B viu disciplina de A");
  const put = await req("PUT", `/api/disciplinas/${d.id}`, { sid: SID_B, body: { ...valida(), nome: "hackeado" } });
  assert.equal(put.status, 404);
  const del = await req("DELETE", `/api/disciplinas/${d.id}`, { sid: SID_B });
  assert.equal(del.status, 404);
  const a = (await req("GET", "/api/disciplinas", { sid: SID_A })).json.disciplinas.find((x) => x.id === d.id);
  assert.equal(a.nome, "Segredo de A");
  assert.equal(a.avaliacoes.length, 3, "avaliações de A foram apagadas pelo PUT/DELETE de B");
});

t("resumo do servidor é igual a calcular() local (POST, PUT e GET)", { skip: semSessao }, async () => {
  const d = await criar(SID_A);
  assert.deepEqual(d.resumo, calcular(d));
  assert.deepEqual(d.resumo, calcular(valida()));
  const novo = { ...valida(), notaMax: 100, mediaAprovacao: 60, mediaExame: 30, mediaFinal: 50,
    avaliacoes: [{ nome: "T", tipo: "trabalho", peso: 0.3, nota: 55.5 }, { nome: "P", tipo: "prova", peso: 0.7, nota: null }] };
  const put = await req("PUT", `/api/disciplinas/${d.id}`, { sid: SID_A, body: novo });
  assert.equal(put.status, 200);
  assert.deepEqual(put.json.disciplina.resumo, calcular(novo));
  assert.deepEqual(put.json.disciplina.avaliacoes.map(({ id, ...r }) => r), novo.avaliacoes);
  const got = (await req("GET", "/api/disciplinas", { sid: SID_A })).json.disciplinas.find((x) => x.id === d.id);
  assert.deepEqual(got.resumo, calcular(got));
});

t("resumo enviado pelo cliente é ignorado", { skip: semSessao }, async () => {
  const d = await criar(SID_A, { ...valida(), resumo: { situacao: "aprovado", mediaParcial: 10 } });
  assert.deepEqual(d.resumo, calcular(valida()));
});

t("sequestro: user_id/userId/id no corpo não troca dono nem alvo", { skip: semSessao }, async () => {
  const me = (await req("GET", "/api/me", { sid: SID_A })).json.user;
  // B tenta criar disciplina em nome de A
  const p = await req("POST", "/api/disciplinas", { sid: SID_B,
    body: { ...valida(), nome: "intrusa", user_id: me.userId, userId: me.userId, id: 1 } });
  assert.equal(p.status, 201);
  criadas.push([SID_B, p.json.disciplina.id]);
  const listaA = (await req("GET", "/api/disciplinas", { sid: SID_A })).json.disciplinas;
  assert.ok(!listaA.some((x) => x.nome === "intrusa"), "disciplina de B apareceu para A");
  // B edita a própria disciplina mandando o id de uma de A no corpo
  const dA = await criar(SID_A, { ...valida(), nome: "alvo" });
  const u = await req("PUT", `/api/disciplinas/${p.json.disciplina.id}`, { sid: SID_B,
    body: { ...valida(), nome: "intrusa2", id: dA.id, user_id: me.userId,
      avaliacoes: [{ id: dA.avaliacoes[0].id, disciplina_id: dA.id, nome: "X", tipo: "prova", peso: 1, nota: 1 }] } });
  assert.equal(u.status, 200);
  assert.equal(u.json.disciplina.id, p.json.disciplina.id);
  const alvo = (await req("GET", "/api/disciplinas", { sid: SID_A })).json.disciplinas.find((x) => x.id === dA.id);
  assert.equal(alvo.nome, "alvo");
  assert.deepEqual(alvo.avaliacoes.map((a) => a.nome), ["P1", "P2", "Lista"]);
});

t("injeção SQL/HTML no nome é gravada literalmente", { skip: semSessao }, async () => {
  const nome = `x'); DROP TABLE disciplinas; -- <script>alert(1)</script>`;
  const d = await criar(SID_A, { ...valida(), nome, avaliacoes: [{ nome: "' OR 1=1 --", tipo: "prova", peso: 1, nota: null }] });
  assert.equal(d.nome, nome);
  assert.equal(d.avaliacoes[0].nome, "' OR 1=1 --");
  const lista = (await req("GET", "/api/disciplinas", { sid: SID_A })).json.disciplinas;
  assert.ok(lista.some((x) => x.nome === nome));
});

t("PUT substitui avaliações; DELETE apaga e depois 404", { skip: semSessao }, async () => {
  const d = await criar(SID_A);
  const r = await req("PUT", `/api/disciplinas/${d.id}`, { sid: SID_A,
    body: { ...valida(), avaliacoes: [{ nome: "Única", tipo: "trabalho", peso: 1, nota: 9 }] } });
  assert.equal(r.json.disciplina.avaliacoes.length, 1);
  assert.equal(r.json.disciplina.resumo.situacao, "aprovado");
  assert.deepEqual((await req("DELETE", `/api/disciplinas/${d.id}`, { sid: SID_A })).json, { ok: true });
  assert.equal((await req("DELETE", `/api/disciplinas/${d.id}`, { sid: SID_A })).status, 404);
  assert.equal((await req("PUT", `/api/disciplinas/${d.id}`, { sid: SID_A, body: valida() })).status, 404);
});

t("limite de 20 disciplinas → 409", { skip: semSessao }, async () => {
  const atual = (await req("GET", "/api/disciplinas", { sid: SID_B })).json.disciplinas.length;
  for (let i = atual; i < 20; i++) await criar(SID_B, { ...valida(), nome: `Lote ${i}` });
  const r = await req("POST", "/api/disciplinas", { sid: SID_B, body: valida() });
  assert.equal(r.status, 409);
});

t("logout responde 200 e expira o cookie (sessão inexistente)", async () => {
  const r = await req("POST", "/api/auth/logout", { cookie: "sid=inexistente-123" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie") || "", /sid=;.*Max-Age=0/);
});
