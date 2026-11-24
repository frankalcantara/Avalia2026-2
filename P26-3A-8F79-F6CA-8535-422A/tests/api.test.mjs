// Suíte de testes da API do Shared To-Do (P26-3A-8F79-F6CA-8535-422A). Contrato: docs/API.md.
// Sem dependências: node:test, node:assert, fetch e WebCrypto nativos (Node 20+).
//
//   BASE_URL       (padrão http://127.0.0.1:8788)
//   SESSION_SECRET (obrigatório; o mesmo do .dev.vars do servidor local)
//
// Os usuários de teste precisam existir na tabela users (tests/seed.sql).

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const SECRET = process.env.SESSION_SECRET;
if (!SECRET) throw new Error("Defina SESSION_SECRET (o mesmo valor do .dev.vars do servidor).");

const ANA = "999900000000000001";
const BRUNO = "999900000000000002";
const INTRUSO = "999900000000000003";
const OREILLY = "999900000000000004";
const CARLA = "999900000000000005";
const FANTASMA = "999900000000000099"; // não existe em users

// ---------- sessão ----------
const enc = new TextEncoder();
const b64url = (buf) => Buffer.from(buf).toString("base64url");

async function sign(data, secret = SECRET) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

// Cookie conforme o contrato: base64url(payload).base64url(HMAC-SHA256(payload codificado)).
async function sessao(uid, { exp = Math.floor(Date.now() / 1000) + 3600, secret = SECRET, payload } = {}) {
  const p = b64url(enc.encode(JSON.stringify(payload ?? { uid, exp })));
  return `session=${p}.${await sign(p, secret)}`;
}

// Troca um caractere no MEIO da assinatura. Não usar o último: em 32 bytes base64url o último caractere
// tem 2 bits de preenchimento que atob() ignora, então trocar A↔B no fim gera a MESMA assinatura.
function adulterar(cookie) {
  const i = cookie.indexOf(".") + 10;
  return cookie.slice(0, i) + (cookie[i] === "A" ? "B" : "A") + cookie.slice(i + 1);
}

// ---------- HTTP ----------
const respostas500 = [];

async function req(method, path, { cookie, body, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  let payload;
  if (raw !== undefined) { payload = raw; h["Content-Type"] ??= "application/json"; }
  else if (body !== undefined) { payload = JSON.stringify(body); h["Content-Type"] = "application/json"; }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* não-JSON */ }
  if (res.status >= 500) respostas500.push(`${method} ${path} → ${res.status} ${text.slice(0, 120)}`);
  return { status: res.status, json, text, headers: res.headers };
}

function erro(r, status, label) {
  const lista = Array.isArray(status) ? status : [status];
  assert.ok(lista.includes(r.status), `${label}: esperado ${lista.join("/")}, obtido ${r.status} ${r.text.slice(0, 200)}`);
  assert.equal(typeof r.json?.error, "string", `${label}: corpo de erro deveria ser { error }, veio ${r.text.slice(0, 200)}`);
}

let C = {}; // cookies por usuário

before(async () => {
  C = {
    ana: await sessao(ANA), bruno: await sessao(BRUNO), intruso: await sessao(INTRUSO), oreilly: await sessao(OREILLY), carla: await sessao(CARLA),
  };
  const r = await req("GET", "/api/me", { cookie: C.ana });
  assert.equal(r.status, 200, `Servidor inacessível ou usuários de teste ausentes (rode tests/seed.sql). ${r.status} ${r.text.slice(0, 200)}`);
});

after(() => {
  // Relatório final: nenhum caso inválido pode ter virado 500.
  if (respostas500.length) console.log("Respostas 5xx observadas:\n" + respostas500.join("\n"));
});

async function novaLista(cookie, name = `Lista ${Date.now()}`) {
  const r = await req("POST", "/api/lists", { cookie, body: { name } });
  assert.equal(r.status, 201, r.text);
  return r.json.list;
}

async function novaTarefa(cookie, listId, body) {
  const r = await req("POST", `/api/lists/${listId}/tasks`, { cookie, body });
  assert.equal(r.status, 201, r.text);
  return r.json.task;
}

// =====================================================================
describe("Sessão", () => {
  const rotas = [
    ["GET", "/api/me"], ["GET", "/api/lists"], ["POST", "/api/lists", { name: "x" }], ["POST", "/api/lists/join", { code: "AAAAAAAA" }],
    ["GET", "/api/lists/1"], ["POST", "/api/lists/1/tasks", { title: "x" }], ["PATCH", "/api/tasks/1", { done: true }], ["DELETE", "/api/tasks/1"],
    ["DELETE", "/api/lists/1/members/1"],
  ];

  test("sem cookie → 401 em todas as rotas protegidas", async () => {
    for (const [m, p, body] of rotas) erro(await req(m, p, { body }), 401, `${m} ${p}`);
  });

  test("assinatura adulterada → 401", async () => {
    const c = C.ana;
    erro(await req("GET", "/api/me", { cookie: adulterar(c) }), 401, "caractere da assinatura trocado");
    const [p] = c.slice("session=".length).split(".");
    erro(await req("GET", "/api/me", { cookie: `session=${p}.` }), 401, "assinatura vazia");
    erro(await req("GET", "/api/me", { cookie: `session=${p}` }), 401, "sem assinatura");
  });

  test("payload trocado mantendo a assinatura de outro usuário → 401", async () => {
    const sigAna = C.ana.split(".")[1];
    const pBruno = C.bruno.slice("session=".length).split(".")[0];
    erro(await req("GET", "/api/me", { cookie: `session=${pBruno}.${sigAna}` }), 401, "payload do Bruno com assinatura da Ana");
  });

  test("maleabilidade: só a grafia canônica da assinatura/payload é aceita", async () => {
    const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const [p, sig] = C.oreilly.slice("session=".length).split(".");
    assert.equal(sig.length, 43);
    assert.equal((await req("GET", "/api/me", { cookie: `session=${p}.${sig}` })).status, 200, "assinatura correta");
    // o último caractere de 43 tem 4 bits de dado + 2 de preenchimento (os 2 bits baixos)
    const v = B64.indexOf(sig.at(-1));
    for (const x of [1, 2, 3]) {
      const s2 = sig.slice(0, -1) + B64[v ^ x];
      erro(await req("GET", "/api/me", { cookie: `session=${p}.${s2}` }), 401, `preenchimento trocado (${sig.at(-1)}→${B64[v ^ x]})`);
    }
    erro(await req("GET", "/api/me", { cookie: `session=${p}.${sig}=` }), 401, "assinatura com = no fim");
    erro(await req("GET", "/api/me", { cookie: `session=${p}=.${sig}` }), 401, "payload com = no fim");
    erro(await req("GET", "/api/me", { cookie: `session=${p}.${sig.slice(0, -1)}` }), 401, "assinatura com 42 caracteres");
  });

  test("assinado com outro segredo → 401", async () => {
    erro(await req("GET", "/api/me", { cookie: await sessao(ANA, { secret: "segredo-errado" }) }), 401, "segredo errado");
  });

  test("sessão expirada → 401", async () => {
    erro(await req("GET", "/api/me", { cookie: await sessao(ANA, { exp: Math.floor(Date.now() / 1000) - 10 }) }), 401, "exp no passado");
  });

  test("payload malformado (assinado corretamente) → 401, não 500", async () => {
    erro(await req("GET", "/api/me", { cookie: await sessao(null, { payload: { uid: 123, exp: 9999999999 } }) }), 401, "uid numérico");
    erro(await req("GET", "/api/me", { cookie: await sessao(null, { payload: { uid: ANA } }) }), 401, "sem exp");
    erro(await req("GET", "/api/me", { cookie: await sessao(null, { payload: { uid: ANA, exp: "9999999999" } }) }), 401, "exp string");
    const lixo = b64url(enc.encode("não é json"));
    erro(await req("GET", "/api/me", { cookie: `session=${lixo}.${await sign(lixo)}` }), 401, "payload não-JSON");
    erro(await req("GET", "/api/me", { cookie: "session=%%%.@@@" }), 401, "base64 inválido");
    erro(await req("GET", "/api/me", { cookie: "session=a.b.c" }), 401, "três partes");
  });

  test("sessão válida de usuário inexistente em users → /api/me 401", async () => {
    erro(await req("GET", "/api/me", { cookie: await sessao(FANTASMA) }), 401, "usuário fantasma");
  });

  test("GET /api/me devolve User do contrato", async () => {
    const r = await req("GET", "/api/me", { cookie: C.ana });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json.user).sort(), ["avatarUrl", "id", "username"]);
    assert.equal(r.json.user.id, ANA);
    assert.equal(r.json.user.username, "teste_ana");
    assert.match(r.headers.get("content-type") || "", /application\/json/);
  });

  test("POST /api/auth/logout → 204 sem corpo e apaga o cookie", async () => {
    const r = await req("POST", "/api/auth/logout", { cookie: C.ana });
    assert.equal(r.status, 204);
    assert.equal(r.text, "");
    const sc = r.headers.get("set-cookie") || "";
    assert.match(sc, /session=;/);
    assert.match(sc, /Max-Age=0/i);
    assert.match(sc, /HttpOnly/i);
  });
});

// =====================================================================
describe("Login Discord (sem rede externa)", () => {
  test("GET /api/auth/discord → 302 para discord.com com state e cookie oauth_state", async () => {
    const r = await req("GET", "/api/auth/discord");
    if (r.status === 500) return assert.fail("DISCORD_CLIENT_ID/SECRET ausentes no .dev.vars de teste — caso não testável");
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get("location"));
    assert.equal(loc.hostname, "discord.com");
    const state = loc.searchParams.get("state");
    assert.ok(state && state.length >= 16, "state ausente/curto");
    assert.equal(loc.searchParams.get("scope"), "identify");
    const sc = r.headers.get("set-cookie") || "";
    assert.ok(sc.includes(`oauth_state=${state}`), "cookie oauth_state não bate com o state");
    assert.match(sc, /HttpOnly/i);
  });

  test("callback com state divergente → 302 /?auth_error=invalid_state, sem sessão", async () => {
    const r = await req("GET", "/api/auth/discord/callback?code=abc&state=xyz", { cookie: "oauth_state=outro" });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/?auth_error=invalid_state");
    assert.ok(!/(^|,\s*)session=[^;]/.test(r.headers.get("set-cookie") || ""), "não deveria criar sessão");
  });

  test("callback sem state → 302 com auth_error", async () => {
    const r = await req("GET", "/api/auth/discord/callback?code=abc");
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location") || "", /^\/\?auth_error=/);
  });
});

// =====================================================================
describe("Listas e entrada por código", () => {
  test("POST /api/lists valida name (vazio, só espaços, >80, tipo, JSON inválido)", async () => {
    erro(await req("POST", "/api/lists", { cookie: C.ana, body: { name: "" } }), 400, "name vazio");
    erro(await req("POST", "/api/lists", { cookie: C.ana, body: { name: "    " } }), 400, "name só espaços");
    erro(await req("POST", "/api/lists", { cookie: C.ana, body: { name: "x".repeat(81) } }), 400, "name 81");
    erro(await req("POST", "/api/lists", { cookie: C.ana, body: { name: 123 } }), 400, "name número");
    erro(await req("POST", "/api/lists", { cookie: C.ana, body: {} }), 400, "sem name");
    erro(await req("POST", "/api/lists", { cookie: C.ana, raw: "{nao json" }), 400, "JSON inválido");
    erro(await req("POST", "/api/lists", { cookie: C.ana, raw: "[1,2]" }), 400, "array");
    erro(await req("POST", "/api/lists", { cookie: C.ana, raw: "null" }), 400, "null");
    erro(await req("POST", "/api/lists", { cookie: C.ana, raw: "" }), 400, "corpo vazio");
  });

  test("POST /api/lists cria lista no formato List com criador owner (80 caracteres aceitos, trim aplicado)", async () => {
    const r = await req("POST", "/api/lists", { cookie: C.ana, body: { name: "  " + "n".repeat(80) + "  " } });
    assert.equal(r.status, 201, r.text);
    const l = r.json.list;
    assert.deepEqual(Object.keys(l).sort(), ["doneCount", "id", "memberCount", "name", "role", "shareCode", "taskCount"]);
    assert.equal(typeof l.id, "number");
    assert.equal(l.name, "n".repeat(80));
    assert.equal(l.role, "owner");
    assert.equal(l.memberCount, 1);
    assert.equal(l.taskCount, 0);
    assert.equal(l.doneCount, 0);
    assert.match(l.shareCode, /^[A-Z0-9]{8}$/);
  });

  test("entrar por código inválido → 404; código vazio/não-string → 400", async () => {
    erro(await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: "ZZZZZZZZ" } }), 404, "código inexistente");
    erro(await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: "" } }), [400, 404], "código vazio");
    erro(await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: 12345678 } }), [400, 404], "código número");
    erro(await req("POST", "/api/lists/join", { cookie: C.bruno, body: {} }), [400, 404], "sem código");
    erro(await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: "x".repeat(5000) } }), [400, 404], "código enorme");
  });

  test("entrar duas vezes não duplica membro; dono entrando no próprio código continua owner", async () => {
    const l = await novaLista(C.ana, "Dupla entrada");
    const r1 = await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: l.shareCode.toLowerCase() } });
    assert.equal(r1.status, 200, r1.text);
    assert.equal(r1.json.list.id, l.id);
    assert.equal(r1.json.list.role, "member");
    assert.equal(r1.json.list.memberCount, 2);
    const r2 = await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: ` ${l.shareCode} ` } });
    assert.equal(r2.status, 200, r2.text);
    assert.equal(r2.json.list.memberCount, 2, "segunda entrada duplicou o membro");
    const r3 = await req("POST", "/api/lists/join", { cookie: C.ana, body: { code: l.shareCode } });
    assert.equal(r3.status, 200, r3.text);
    assert.equal(r3.json.list.role, "owner", "dono virou member ao entrar pelo código");
    assert.equal(r3.json.list.memberCount, 2);
    const det = await req("GET", `/api/lists/${l.id}`, { cookie: C.ana });
    assert.equal(det.json.members.length, 2);
    // entradas concorrentes também não duplicam
    const l2 = await novaLista(C.ana, "Concorrência");
    const rs = await Promise.all(Array.from({ length: 5 }, () => req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: l2.shareCode } })));
    rs.forEach((r) => assert.equal(r.status, 200, r.text));
    const det2 = await req("GET", `/api/lists/${l2.id}`, { cookie: C.ana });
    assert.equal(det2.json.members.length, 2);
  });

  test("GET /api/lists mostra só as listas de que sou membro", async () => {
    const l = await novaLista(C.ana, "Privada da Ana");
    const r = await req("GET", "/api/lists", { cookie: C.intruso });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.lists));
    assert.ok(!r.json.lists.some((x) => x.id === l.id), "intruso vê lista alheia");
    const ra = await req("GET", "/api/lists", { cookie: C.ana });
    assert.ok(ra.json.lists.some((x) => x.id === l.id));
  });

  test("ids de rota inválidos → 404 JSON", async () => {
    for (const p of ["/api/lists/abc", "/api/lists/0", "/api/lists/-1", "/api/lists/1.5", "/api/lists/99999999999", "/api/lists/1e3"]) {
      erro(await req("GET", p, { cookie: C.ana }), 404, p);
    }
    for (const p of ["/api/tasks/abc", "/api/tasks/0", "/api/tasks/99999999999"]) {
      erro(await req("PATCH", p, { cookie: C.ana, body: { done: true } }), 404, p);
    }
    erro(await req("GET", "/api/nao-existe", { cookie: C.ana }), 404, "rota inexistente");
  });
});

// =====================================================================
describe("Isolamento entre listas", () => {
  let lista, tarefa;
  before(async () => {
    lista = await novaLista(C.ana, "Isolada");
    tarefa = await novaTarefa(C.ana, lista.id, { title: "segredo" });
  });

  test("não membro não lê a lista", async () => {
    erro(await req("GET", `/api/lists/${lista.id}`, { cookie: C.intruso }), [403, 404], "GET lista alheia");
  });

  test("não membro não cria tarefa na lista", async () => {
    erro(await req("POST", `/api/lists/${lista.id}/tasks`, { cookie: C.intruso, body: { title: "invasão" } }), [403, 404], "POST tarefa");
  });

  test("não membro não altera nem exclui tarefa (e ela continua intacta)", async () => {
    erro(await req("PATCH", `/api/tasks/${tarefa.id}`, { cookie: C.intruso, body: { done: true } }), [403, 404], "PATCH done");
    erro(await req("PATCH", `/api/tasks/${tarefa.id}`, { cookie: C.intruso, body: { title: "hackeado" } }), [403, 404], "PATCH title");
    erro(await req("PATCH", `/api/tasks/${tarefa.id}`, { cookie: C.intruso, body: { assigneeId: INTRUSO } }), [403, 404], "PATCH assignee");
    erro(await req("DELETE", `/api/tasks/${tarefa.id}`, { cookie: C.intruso }), [403, 404], "DELETE");
    const r = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    const t = r.json.tasks.find((x) => x.id === tarefa.id);
    assert.ok(t, "tarefa sumiu");
    assert.equal(t.title, "segredo");
    assert.equal(t.done, false);
    assert.equal(t.assignee, null);
  });

  test("lista inexistente e lista alheia dão a mesma resposta (não revela existência)", async () => {
    const a = await req("GET", `/api/lists/${lista.id}`, { cookie: C.intruso });
    const b = await req("GET", "/api/lists/987654321", { cookie: C.intruso });
    assert.equal(a.status, b.status);
  });
});

// =====================================================================
describe("Regras de tarefa", () => {
  let lista, outra, pai, sub, tOutra;
  before(async () => {
    lista = await novaLista(C.ana, "Regras");
    await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: lista.shareCode } });
    outra = await novaLista(C.ana, "Outra");
    pai = await novaTarefa(C.ana, lista.id, { title: "pai" });
    sub = await novaTarefa(C.ana, lista.id, { title: "filha", parentId: pai.id });
    tOutra = await novaTarefa(C.ana, outra.id, { title: "da outra lista" });
  });

  test("título vazio, só espaços, >200, não-string ou ausente → 400", async () => {
    const p = `/api/lists/${lista.id}/tasks`;
    erro(await req("POST", p, { cookie: C.ana, body: { title: "" } }), 400, "vazio");
    erro(await req("POST", p, { cookie: C.ana, body: { title: " \t\n " } }), 400, "espaços");
    erro(await req("POST", p, { cookie: C.ana, body: { title: "t".repeat(201) } }), 400, "201");
    erro(await req("POST", p, { cookie: C.ana, body: { title: "t".repeat(100000) } }), 400, "100k");
    erro(await req("POST", p, { cookie: C.ana, body: { title: 42 } }), 400, "número");
    erro(await req("POST", p, { cookie: C.ana, body: { title: ["a"] } }), 400, "array");
    erro(await req("POST", p, { cookie: C.ana, body: {} }), 400, "ausente");
    erro(await req("POST", p, { cookie: C.ana, raw: "nao-json" }), 400, "JSON inválido");
  });

  test("título com exatamente 200 caracteres (após trim) é aceito", async () => {
    const t = await novaTarefa(C.ana, lista.id, { title: "  " + "t".repeat(200) + "  " });
    assert.equal(t.title, "t".repeat(200));
  });

  test("PATCH título vazio/longo → 400", async () => {
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { title: "" } }), 400, "vazio");
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { title: "t".repeat(201) } }), 400, "201");
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { title: null } }), 400, "null");
  });

  test("done precisa ser booleano; PATCH sem campos → 400", async () => {
    for (const done of ["true", 1, 0, null, "sim"]) {
      erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { done } }), 400, `done=${JSON.stringify(done)}`);
    }
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: {} }), 400, "corpo vazio");
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { foo: 1 } }), 400, "campo desconhecido");
  });

  test("responsável que não é membro → 400 (criar e alterar)", async () => {
    const p = `/api/lists/${lista.id}/tasks`;
    erro(await req("POST", p, { cookie: C.ana, body: { title: "x", assigneeId: INTRUSO } }), 400, "POST intruso");
    erro(await req("POST", p, { cookie: C.ana, body: { title: "x", assigneeId: FANTASMA } }), 400, "POST inexistente");
    erro(await req("POST", p, { cookie: C.ana, body: { title: "x", assigneeId: Number(BRUNO) } }), 400, "POST id numérico");
    erro(await req("POST", p, { cookie: C.ana, body: { title: "x", assigneeId: "" } }), 400, "POST id vazio");
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { assigneeId: INTRUSO } }), 400, "PATCH intruso");
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { assigneeId: { id: BRUNO } } }), 400, "PATCH objeto");
    // membro de OUTRA lista em que a Ana também está não serve
    const r = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    assert.equal(r.json.tasks.find((t) => t.id === pai.id).assignee, null, "responsável inválido foi gravado");
  });

  test("subtarefa com pai de outra lista → 400", async () => {
    erro(await req("POST", `/api/lists/${lista.id}/tasks`, { cookie: C.ana, body: { title: "x", parentId: tOutra.id } }), 400, "pai de outra lista");
  });

  test("sub-subtarefa (pai que já é subtarefa) → 400", async () => {
    erro(await req("POST", `/api/lists/${lista.id}/tasks`, { cookie: C.ana, body: { title: "neta", parentId: sub.id } }), 400, "sub-subtarefa");
  });

  test("parentId inexistente, string, decimal, negativo ou booleano → 400", async () => {
    const p = `/api/lists/${lista.id}/tasks`;
    for (const parentId of [987654321, String(pai.id), pai.id + 0.5, -1, 0, true, [pai.id]]) {
      erro(await req("POST", p, { cookie: C.ana, body: { title: "x", parentId } }), 400, `parentId=${JSON.stringify(parentId)}`);
    }
  });

  test("parentId null e assigneeId null são aceitos como ausência", async () => {
    const t = await novaTarefa(C.ana, lista.id, { title: "solta", parentId: null, assigneeId: null });
    assert.equal(t.parentId, null);
    assert.equal(t.assignee, null);
  });

  test("Task no formato do contrato", async () => {
    const t = await novaTarefa(C.ana, lista.id, { title: "formato", assigneeId: BRUNO, parentId: pai.id });
    assert.deepEqual(Object.keys(t).sort(), ["assignee", "createdBy", "done", "id", "parentId", "title", "updatedAt"]);
    assert.equal(typeof t.id, "number");
    assert.equal(t.parentId, pai.id);
    assert.equal(t.done, false);
    assert.equal(t.createdBy, ANA);
    assert.deepEqual(t.assignee, { id: BRUNO, username: "teste_bruno", avatarUrl: "https://cdn.discordapp.com/embed/avatars/2.png" });
    assert.match(t.updatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  });
});

// =====================================================================
describe("Fluxo feliz com dois usuários", () => {
  let lista, tarefa, sub;

  test("Ana cria a lista e Bruno entra pelo código", async () => {
    lista = await novaLista(C.ana, "TCC");
    const r = await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: lista.shareCode } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.list.name, "TCC");
  });

  test("Ana cria tarefa atribuída ao Bruno; Bruno cria subtarefa e se atribui; conclui", async () => {
    tarefa = await novaTarefa(C.ana, lista.id, { title: "Escrever intro", assigneeId: BRUNO });
    assert.equal(tarefa.assignee.id, BRUNO);
    sub = await novaTarefa(C.bruno, lista.id, { title: "Revisar referências", parentId: tarefa.id });
    assert.equal(sub.parentId, tarefa.id);
    assert.equal(sub.createdBy, BRUNO);

    let r = await req("PATCH", `/api/tasks/${sub.id}`, { cookie: C.bruno, body: { assigneeId: ANA } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.task.assignee.id, ANA);

    r = await req("PATCH", `/api/tasks/${sub.id}`, { cookie: C.ana, body: { done: true } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.task.done, true);

    r = await req("PATCH", `/api/tasks/${tarefa.id}`, { cookie: C.bruno, body: { title: "  Escrever introdução  ", assigneeId: null } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.task.title, "Escrever introdução");
    assert.equal(r.json.task.assignee, null);
    assert.equal(r.json.task.parentId, null);
  });

  test("os dois usuários leem o mesmo estado", async () => {
    const a = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    const b = await req("GET", `/api/lists/${lista.id}`, { cookie: C.bruno });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(a.json.tasks, b.json.tasks);
    assert.deepEqual(a.json.members, b.json.members);
    assert.equal(a.json.list.role, "owner");
    assert.equal(b.json.list.role, "member");
    for (const x of [a.json.list, b.json.list]) {
      assert.equal(x.memberCount, 2);
      assert.equal(x.taskCount, 2);
      assert.equal(x.doneCount, 1);
    }
    // members = User + role
    const ms = Object.fromEntries(a.json.members.map((m) => [m.id, m]));
    assert.deepEqual(Object.keys(ms[ANA]).sort(), ["avatarUrl", "id", "role", "username"]);
    assert.equal(ms[ANA].role, "owner");
    assert.equal(ms[BRUNO].role, "member");
    // tarefa principal antes da subtarefa
    const ids = a.json.tasks.map((t) => t.id);
    assert.ok(ids.indexOf(tarefa.id) < ids.indexOf(sub.id));
    const s = a.json.tasks.find((t) => t.id === sub.id);
    assert.equal(s.done, true);
    assert.equal(s.assignee.id, ANA);
    // aparece em GET /api/lists dos dois
    const lb = await req("GET", "/api/lists", { cookie: C.bruno });
    assert.ok(lb.json.lists.some((l) => l.id === lista.id && l.role === "member"));
  });

  test("DELETE da tarefa principal → 204 sem corpo e leva as subtarefas", async () => {
    const r = await req("DELETE", `/api/tasks/${tarefa.id}`, { cookie: C.bruno });
    assert.equal(r.status, 204);
    assert.equal(r.text, "");
    const a = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    assert.equal(a.json.tasks.length, 0, "subtarefa sobrou: " + JSON.stringify(a.json.tasks));
    assert.equal(a.json.list.taskCount, 0);
    erro(await req("PATCH", `/api/tasks/${sub.id}`, { cookie: C.ana, body: { done: false } }), 404, "subtarefa apagada");
    erro(await req("DELETE", `/api/tasks/${tarefa.id}`, { cookie: C.ana }), 404, "DELETE repetido");
  });

  test("DELETE de subtarefa não apaga o pai", async () => {
    const p = await novaTarefa(C.ana, lista.id, { title: "pai2" });
    const s = await novaTarefa(C.ana, lista.id, { title: "filha2", parentId: p.id });
    assert.equal((await req("DELETE", `/api/tasks/${s.id}`, { cookie: C.ana })).status, 204);
    const a = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    assert.deepEqual(a.json.tasks.map((t) => t.id), [p.id]);
  });
});

// =====================================================================
describe("Injeção e texto literal", () => {
  test("SQL e HTML em name/title/code são armazenados como texto literal", async () => {
    const nome = `x' OR '1'='1"; DROP TABLE lists; --`;
    const l = await novaLista(C.ana, nome);
    assert.equal(l.name, nome);
    const titulo = `'); DELETE FROM tasks; -- <img src=x onerror=alert(1)>`;
    const t = await novaTarefa(C.ana, l.id, { title: titulo });
    assert.equal(t.title, titulo);
    const r = await req("PATCH", `/api/tasks/${t.id}`, { cookie: C.ana, body: { title: `a' WHERE 1=1; --` } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.task.title, `a' WHERE 1=1; --`);
    const d = await req("GET", `/api/lists/${l.id}`, { cookie: C.ana });
    assert.equal(d.json.list.name, nome);
    assert.equal(d.json.tasks[0].title, `a' WHERE 1=1; --`);
    erro(await req("POST", "/api/lists/join", { cookie: C.intruso, body: { code: "' OR 1=1 --" } }), 404, "código com SQL");
    erro(await req("POST", "/api/lists/join", { cookie: C.intruso, body: { code: "%" } }), 404, "código curinga");
    erro(await req("POST", `/api/lists/${l.id}/tasks`, { cookie: C.ana, body: { title: "x", assigneeId: `' OR '1'='1` } }), 400, "assigneeId com SQL");
    // as tabelas continuam lá
    assert.equal((await req("GET", "/api/lists", { cookie: C.ana })).status, 200);
  });

  test("username com aspas/HTML volta literal em members e assignee", async () => {
    const l = await novaLista(C.ana, "Aspas");
    await req("POST", "/api/lists/join", { cookie: C.oreilly, body: { code: l.shareCode } });
    const t = await novaTarefa(C.ana, l.id, { title: "x", assigneeId: OREILLY });
    assert.equal(t.assignee.username, "teste_o'reilly <b>x</b>");
  });

  test("sessão com uid contendo SQL não autentica", async () => {
    const l = await req("GET", "/api/lists", { cookie: await sessao(`' OR '1'='1`) });
    assert.ok(l.status === 401 || (l.status === 200 && l.json.lists.length === 0), `uid SQL vazou listas: ${l.status} ${l.text.slice(0, 200)}`);
    const r = await req("GET", "/api/me", { cookie: await sessao(`' OR '1'='1`) });
    erro(r, 401, "/api/me com uid SQL");
  });
});

// =====================================================================
describe("Métodos não permitidos e respostas JSON", () => {
  test("métodos não suportados → 405 (ou 404) JSON, nunca o index.html", async () => {
    const casos = [
      ["PUT", "/api/lists"], ["DELETE", "/api/lists"], ["PATCH", "/api/lists"],
      ["GET", "/api/lists/join"], ["DELETE", "/api/lists/1"], ["PATCH", "/api/lists/1"],
      ["GET", "/api/lists/1/tasks"], ["GET", "/api/tasks/1"], ["POST", "/api/tasks/1"], ["PUT", "/api/tasks/1"],
      ["POST", "/api/me"], ["GET", "/api/auth/logout"], ["POST", "/api/auth/discord"],
      ["GET", "/api/lists/1/members/1"], ["POST", "/api/lists/1/members/1"], ["DELETE", "/api/lists/1/members"],
    ];
    for (const [m, p] of casos) {
      const r = await req(m, p, { cookie: C.ana, body: m === "GET" ? undefined : {} });
      erro(r, [405, 404], `${m} ${p}`);
    }
  });
});

// =====================================================================
describe("Edição de título (PATCH title)", () => {
  let lista, pai, sub;
  before(async () => {
    lista = await novaLista(C.ana, "Edição");
    await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: lista.shareCode } });
    pai = await novaTarefa(C.ana, lista.id, { title: "original", assigneeId: BRUNO });
    sub = await novaTarefa(C.ana, lista.id, { title: "sub original", parentId: pai.id });
  });

  test("PATCH title aplica trim e mantém done/assignee/parentId", async () => {
    const r = await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { title: "  \t novo título  \n" } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.task.title, "novo título");
    assert.equal(r.json.task.assignee?.id, BRUNO, "editar título apagou o responsável");
    assert.equal(r.json.task.done, false);
    assert.equal(r.json.task.parentId, null);
    const rs = await req("PATCH", `/api/tasks/${sub.id}`, { cookie: C.bruno, body: { title: " sub editada " } });
    assert.equal(rs.status, 200, rs.text);
    assert.equal(rs.json.task.title, "sub editada");
    assert.equal(rs.json.task.parentId, pai.id);
  });

  test("PATCH title vazio, só espaços, 201 caracteres, não-string → 400 e título preservado", async () => {
    const casos = [["", "vazio"], ["   ", "espaços"], ["t".repeat(201), "201"], ["  " + "t".repeat(201) + "  ", "201 com espaços"], [123, "número"], [null, "null"]];
    for (const [title, label] of casos) {
      erro(await req("PATCH", `/api/tasks/${sub.id}`, { cookie: C.bruno, body: { title } }), 400, `sub ${label}`);
    }
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.bruno, body: { title: "t".repeat(201) } }), 400, "pai 201");
    // título inválido junto com done válido não grava nada
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.bruno, body: { title: "", done: true } }), 400, "title vazio + done");
    const d = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    assert.equal(d.json.tasks.find((t) => t.id === pai.id).title, "novo título");
    assert.equal(d.json.tasks.find((t) => t.id === pai.id).done, false, "done gravado apesar do 400");
    assert.equal(d.json.tasks.find((t) => t.id === sub.id).title, "sub editada");
  });

  test("200 caracteres após trim são aceitos na edição", async () => {
    const r = await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { title: " " + "e".repeat(200) + " " } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.task.title, "e".repeat(200));
  });

  test("novo título aparece para o outro membro", async () => {
    const r = await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.ana, body: { title: "Título da Ana" } });
    assert.equal(r.status, 200, r.text);
    assert.match(r.json.task.updatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    const b = await req("GET", `/api/lists/${lista.id}`, { cookie: C.bruno });
    assert.equal(b.status, 200);
    const t = b.json.tasks.find((x) => x.id === pai.id);
    assert.equal(t.title, "Título da Ana");
    assert.equal(t.updatedAt, r.json.task.updatedAt);
    assert.equal(b.json.tasks.find((x) => x.id === sub.id).title, "sub editada");
  });

  test("não membro não edita título", async () => {
    erro(await req("PATCH", `/api/tasks/${pai.id}`, { cookie: C.intruso, body: { title: "invasor" } }), 404, "intruso PATCH title");
  });
});

// =====================================================================
describe("Membros: sair e remover (DELETE /api/lists/:id/members/:userId)", () => {
  const rota = (listId, userId) => `/api/lists/${listId}/members/${userId}`;
  let lista;
  before(async () => {
    lista = await novaLista(C.ana, "Membros");
    for (const c of [C.bruno, C.carla]) {
      const r = await req("POST", "/api/lists/join", { cookie: c, body: { code: lista.shareCode } });
      assert.equal(r.status, 200, r.text);
    }
  });

  const membros = async () => (await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana })).json.members.map((m) => m.id).sort();

  test("sem sessão / sessão adulterada → 401", async () => {
    erro(await req("DELETE", rota(lista.id, BRUNO)), 401, "sem cookie");
    erro(await req("DELETE", rota(lista.id, BRUNO), { cookie: adulterar(C.bruno) }), 401, "adulterado");
    assert.deepEqual(await membros(), [ANA, BRUNO, CARLA]);
  });

  test("userId ou listId inválido → 404 JSON", async () => {
    for (const u of ["abc", "-1", "1.5", "1".repeat(21), " ", "' OR 1=1 --", "999900000000000001x"]) {
      erro(await req("DELETE", rota(lista.id, encodeURIComponent(u)), { cookie: C.ana }), 404, `userId=${u}`);
    }
    erro(await req("DELETE", rota("abc", BRUNO), { cookie: C.ana }), 404, "listId abc");
    erro(await req("DELETE", rota(0, BRUNO), { cookie: C.ana }), 404, "listId 0");
    erro(await req("DELETE", rota(987654321, ANA), { cookie: C.ana }), 404, "lista inexistente");
    assert.deepEqual(await membros(), [ANA, BRUNO, CARLA]);
  });

  test("GET/POST/PUT/PATCH na rota de membro → 405 JSON", async () => {
    for (const m of ["GET", "POST", "PUT", "PATCH"]) {
      erro(await req(m, rota(lista.id, BRUNO), { cookie: C.ana, body: m === "GET" ? undefined : {} }), 405, m);
    }
  });

  test("não membro chamando → 404 (sair ou remover), lista intacta", async () => {
    erro(await req("DELETE", rota(lista.id, INTRUSO), { cookie: C.intruso }), 404, "intruso sai");
    erro(await req("DELETE", rota(lista.id, BRUNO), { cookie: C.intruso }), 404, "intruso remove Bruno");
    erro(await req("DELETE", rota(lista.id, ANA), { cookie: C.intruso }), 404, "intruso remove dono");
    assert.deepEqual(await membros(), [ANA, BRUNO, CARLA]);
  });

  test("membro removendo outro membro → 403; membro removendo o dono → 403", async () => {
    erro(await req("DELETE", rota(lista.id, CARLA), { cookie: C.bruno }), 403, "Bruno remove Carla");
    erro(await req("DELETE", rota(lista.id, ANA), { cookie: C.bruno }), 403, "Bruno remove dono");
    erro(await req("DELETE", rota(lista.id, INTRUSO), { cookie: C.bruno }), [403, 404], "Bruno remove não membro");
    assert.deepEqual(await membros(), [ANA, BRUNO, CARLA]);
  });

  test("dono tentando sair (remover a si mesmo) → 409 e continua dono", async () => {
    erro(await req("DELETE", rota(lista.id, ANA), { cookie: C.ana }), 409, "dono sai");
    const d = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    assert.equal(d.status, 200);
    assert.equal(d.json.list.role, "owner");
    assert.equal(d.json.list.memberCount, 3);
  });

  test("dono removendo alvo que não é membro → 404", async () => {
    erro(await req("DELETE", rota(lista.id, INTRUSO), { cookie: C.ana }), 404, "alvo não membro");
    erro(await req("DELETE", rota(lista.id, FANTASMA), { cookie: C.ana }), 404, "alvo inexistente");
  });

  test("membro sai → 204 sem corpo, perde o acesso e some de GET /api/lists; sair de novo → 404", async () => {
    const t = await novaTarefa(C.carla, lista.id, { title: "da Carla", assigneeId: CARLA });
    const r = await req("DELETE", rota(lista.id, CARLA), { cookie: C.carla });
    assert.equal(r.status, 204, r.text);
    assert.equal(r.text, "");
    erro(await req("GET", `/api/lists/${lista.id}`, { cookie: C.carla }), 404, "GET lista após sair");
    erro(await req("POST", `/api/lists/${lista.id}/tasks`, { cookie: C.carla, body: { title: "x" } }), 404, "POST tarefa após sair");
    erro(await req("PATCH", `/api/tasks/${t.id}`, { cookie: C.carla, body: { done: true } }), 404, "PATCH tarefa após sair");
    erro(await req("DELETE", `/api/tasks/${t.id}`, { cookie: C.carla }), 404, "DELETE tarefa após sair");
    const ls = await req("GET", "/api/lists", { cookie: C.carla });
    assert.equal(ls.status, 200);
    assert.ok(!ls.json.lists.some((l) => l.id === lista.id), "lista ainda aparece para quem saiu");
    erro(await req("DELETE", rota(lista.id, CARLA), { cookie: C.carla }), 404, "sair de novo");
    // a tarefa criada por ela continua, sem responsável
    const d = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    const tt = d.json.tasks.find((x) => x.id === t.id);
    assert.ok(tt, "tarefa de quem saiu foi apagada");
    assert.equal(tt.assignee, null);
    assert.equal(tt.done, false);
    assert.equal(d.json.list.memberCount, 2);
    assert.ok(!d.json.members.some((m) => m.id === CARLA));
  });

  test("dono remove membro → 204; tarefas dele ficam assignee null, demais intactas", async () => {
    const pB = await novaTarefa(C.ana, lista.id, { title: "do Bruno", assigneeId: BRUNO });
    const sB = await novaTarefa(C.ana, lista.id, { title: "sub do Bruno", parentId: pB.id, assigneeId: BRUNO });
    const pA = await novaTarefa(C.ana, lista.id, { title: "da Ana", assigneeId: ANA });
    const pN = await novaTarefa(C.bruno, lista.id, { title: "sem ninguém" });
    await req("PATCH", `/api/tasks/${pA.id}`, { cookie: C.ana, body: { done: true } });
    await req("PATCH", `/api/tasks/${sB.id}`, { cookie: C.bruno, body: { done: true } });
    // Bruno também é responsável numa OUTRA lista: não pode ser afetada
    const outra = await novaLista(C.ana, "Outra do Bruno");
    await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: outra.shareCode } });
    const tOutra = await novaTarefa(C.ana, outra.id, { title: "fora", assigneeId: BRUNO });

    const antes = (await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana })).json.tasks;
    const r = await req("DELETE", rota(lista.id, BRUNO), { cookie: C.ana });
    assert.equal(r.status, 204, r.text);
    assert.equal(r.text, "");

    const d = await req("GET", `/api/lists/${lista.id}`, { cookie: C.ana });
    const por = Object.fromEntries(d.json.tasks.map((t) => [t.id, t]));
    assert.equal(por[pB.id].assignee, null);
    assert.equal(por[sB.id].assignee, null);
    assert.equal(por[sB.id].parentId, pB.id);
    assert.equal(por[sB.id].done, true);
    assert.equal(por[pA.id].assignee?.id, ANA, "tarefa da Ana perdeu o responsável");
    assert.equal(por[pA.id].done, true);
    assert.equal(por[pN.id].createdBy, BRUNO);
    assert.equal(d.json.tasks.length, antes.length, "remoção apagou tarefas");
    for (const t of antes) {
      assert.equal(por[t.id].title, t.title);
      assert.equal(por[t.id].done, t.done);
      if (t.assignee?.id !== BRUNO) assert.deepEqual(por[t.id].assignee, t.assignee, `assignee da tarefa ${t.id} mudou`);
    }
    assert.deepEqual(d.json.members.map((m) => m.id), [ANA]);
    assert.equal(d.json.list.memberCount, 1);

    const o = await req("GET", `/api/lists/${outra.id}`, { cookie: C.bruno });
    assert.equal(o.status, 200, "remoção afetou outra lista");
    assert.equal(o.json.tasks.find((t) => t.id === tOutra.id).assignee?.id, BRUNO, "assignee de outra lista foi limpo");

    erro(await req("GET", `/api/lists/${lista.id}`, { cookie: C.bruno }), 404, "removido lê lista");
    erro(await req("PATCH", `/api/tasks/${pB.id}`, { cookie: C.bruno, body: { title: "volta" } }), 404, "removido edita");
    erro(await req("POST", `/api/lists/${lista.id}/tasks`, { cookie: C.bruno, body: { title: "x" } }), 404, "removido cria");
    const lb = await req("GET", "/api/lists", { cookie: C.bruno });
    assert.ok(!lb.json.lists.some((l) => l.id === lista.id), "lista ainda aparece para o removido");
    erro(await req("DELETE", rota(lista.id, BRUNO), { cookie: C.ana }), 404, "remover de novo");
  });

  test("depois de removido, atribuir tarefa a ele → 400 (POST e PATCH)", async () => {
    erro(await req("POST", `/api/lists/${lista.id}/tasks`, { cookie: C.ana, body: { title: "x", assigneeId: BRUNO } }), 400, "POST assignee removido");
    const t = await novaTarefa(C.ana, lista.id, { title: "y" });
    erro(await req("PATCH", `/api/tasks/${t.id}`, { cookie: C.ana, body: { assigneeId: BRUNO } }), 400, "PATCH assignee removido");
    erro(await req("PATCH", `/api/tasks/${t.id}`, { cookie: C.ana, body: { assigneeId: CARLA } }), 400, "PATCH assignee que saiu");
  });

  test("removido pode reentrar com o código, como member, e volta a ter acesso", async () => {
    const r = await req("POST", "/api/lists/join", { cookie: C.bruno, body: { code: lista.shareCode } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.list.role, "member");
    assert.equal(r.json.list.memberCount, 2);
    const d = await req("GET", `/api/lists/${lista.id}`, { cookie: C.bruno });
    assert.equal(d.status, 200);
    const t = await novaTarefa(C.ana, lista.id, { title: "de volta", assigneeId: BRUNO });
    assert.equal(t.assignee.id, BRUNO);
  });
});

// =====================================================================
describe("Robustez", () => {
  test("nenhuma resposta 5xx em toda a suíte", () => {
    assert.deepEqual(respostas500, []);
  });
});
