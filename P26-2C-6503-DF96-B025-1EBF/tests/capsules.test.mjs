/**
 * Testes da regra de segurança temporal e das validações do servidor.
 * Usa SQLite real (node:sqlite) com a mesma migração do D1, atrás de um adaptador
 * com a API do D1 (prepare/bind/run/first/all). Sem dependências externas.
 *
 * Rodar (Node 22+):  node tests/capsules.test.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { onRequestGet as capsulesGet, onRequestPost as capsulesPost } from "../functions/api/capsules.js";
import { onRequestGet as messagesGet, onRequestPost as messagesPost } from "../functions/api/messages.js";
import { onRequestGet as meGet } from "../functions/api/auth/me.js";
import { onRequestPost as logoutPost } from "../functions/api/auth/logout.js";
import { createSession } from "../functions/_lib/util.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://teste.pages.dev";
const SECRET = "SEGREDO-DA-CAPSULA-12345";

function makeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(root, "migrations/0002_mural_capsulas.sql"), "utf8"));
  return {
    raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const make = (args) => ({
        run: async () => {
          const r = stmt.run(...args);
          return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } };
        },
        first: async () => stmt.get(...args) ?? null,
        all: async () => ({ results: stmt.all(...args).map((o) => ({ ...o })) }),
      });
      return { bind: (...args) => make(args), ...make([]) };
    },
  };
}

const env = { DB: makeD1() };
const now = () => new Date().toISOString();
const addUser = (id, name) =>
  env.DB.raw.prepare("INSERT INTO users (id, username, avatar, created_at, updated_at) VALUES (?,?,?,?,?)")
    .run(id, name, "https://cdn.discordapp.com/embed/avatars/0.png", now(), now());

addUser("111", "Ana");
addUser("222", "Bruno");
const tokenAna = await createSession(env, "111");
const tokenBruno = await createSession(env, "222");

function req(method, route, { token, body, origin = ORIGIN } = {}) {
  const headers = { Origin: origin };
  if (token) headers.Cookie = `session=${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new Request(ORIGIN + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const call = async (fn, request) => {
  const res = await fn({ request, env });
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null, headers: res.headers };
};

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✅", name); }
  catch (e) { console.error("  ❌", name, "\n    ", e.message); process.exitCode = 1; }
}

const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();
const inSeconds = (s) => new Date(Date.now() + s * 1000).toISOString();

console.log("\nRegra de bloqueio temporal");

await test("POST sem login retorna 401", async () => {
  const r = await call(capsulesPost, req("POST", "/api/capsules", { body: { title: "x", content: "y", audience: "turma", unlock_date: inDays(1) } }));
  assert.equal(r.status, 401);
});

await test("POST com data no passado é rejeitado (400)", async () => {
  const r = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, body: { title: "x", content: "y", audience: "turma", unlock_date: inDays(-1) } }));
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "unlock_date_not_future");
});

await test("POST com data inválida, título vazio ou audiência inválida é rejeitado", async () => {
  const base = { title: "t", content: "c", audience: "turma", unlock_date: inDays(2) };
  for (const bad of [{ unlock_date: "ontem" }, { title: "   " }, { audience: "todos" }, { content: "" }]) {
    const r = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, body: { ...base, ...bad } }));
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

await test("POST com data a mais de 30 anos é rejeitado", async () => {
  const r = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, body: { title: "t", content: "c", audience: "turma", unlock_date: inDays(365 * 31) } }));
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "unlock_date_too_far");
});

await test("POST de origem cruzada é bloqueado (403)", async () => {
  const r = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, origin: "https://evil.example", body: { title: "t", content: "c", audience: "turma", unlock_date: inDays(2) } }));
  assert.equal(r.status, 403);
});

let lockedId;
await test("POST válido cria cápsula e a resposta NÃO contém o texto", async () => {
  const r = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, body: { title: "Formatura", content: SECRET, audience: "turma", unlock_date: inDays(365) } }));
  assert.equal(r.status, 201);
  assert.equal(r.json.locked, true);
  assert.ok(!("content" in r.json));
  assert.ok(!r.text.includes(SECRET));
  lockedId = r.json.id;
});

await test("GET anônimo: cápsula trancada só traz metadados e o texto não aparece no JSON", async () => {
  const r = await call(capsulesGet, req("GET", "/api/capsules"));
  assert.equal(r.status, 200);
  const c = r.json.capsules.find((x) => x.id === lockedId);
  assert.ok(c, "cápsula deve aparecer na lista");
  assert.equal(c.locked, true);
  assert.equal(c.title, "Formatura");
  assert.equal(c.author.name, "Ana");
  assert.ok(c.seconds_remaining > 364 * 86400);
  assert.ok(!("content" in c));
  assert.ok(!r.text.includes(SECRET), "o texto secreto vazou no corpo da resposta");
});

await test("GET como a própria autora: continua sem texto antes da data", async () => {
  const r = await call(capsulesGet, req("GET", "/api/capsules", { token: tokenAna }));
  assert.ok(!r.text.includes(SECRET));
  assert.equal(r.json.capsules.find((x) => x.id === lockedId).is_mine, true);
});

await test("Cápsula cuja data já passou é entregue com o texto", async () => {
  env.DB.raw.prepare("INSERT INTO capsules (user_id,title,content,audience,unlock_date,created_at) VALUES (?,?,?,?,?,?)")
    .run("111", "Antiga", "mensagem liberada", "turma", inSeconds(-5), now());
  const r = await call(capsulesGet, req("GET", "/api/capsules"));
  const c = r.json.capsules.find((x) => x.title === "Antiga");
  assert.equal(c.locked, false);
  assert.equal(c.content, "mensagem liberada");
  assert.ok(!("seconds_remaining" in c));
});

await test("Virada no tempo: ao passar unlock_date, o mesmo registro passa a trazer o texto", async () => {
  const r1 = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, body: { title: "Quase", content: "abre logo", audience: "turma", unlock_date: inSeconds(120) } }));
  assert.equal(r1.json.locked, true);
  // simula a passagem do tempo movendo a data para o passado diretamente no banco
  env.DB.raw.prepare("UPDATE capsules SET unlock_date = ? WHERE id = ?").run(inSeconds(-1), r1.json.id);
  const r2 = await call(capsulesGet, req("GET", "/api/capsules"));
  const c = r2.json.capsules.find((x) => x.id === r1.json.id);
  assert.equal(c.locked, false);
  assert.equal(c.content, "abre logo");
});

let selfId;
await test("Cápsula 'self' é invisível para outros usuários e anônimos", async () => {
  const p = await call(capsulesPost, req("POST", "/api/capsules", { token: tokenAna, body: { title: "Só minha", content: "privado", audience: "self", unlock_date: inDays(10) } }));
  selfId = p.json.id;
  const bruno = await call(capsulesGet, req("GET", "/api/capsules", { token: tokenBruno }));
  const anon = await call(capsulesGet, req("GET", "/api/capsules"));
  const ana = await call(capsulesGet, req("GET", "/api/capsules", { token: tokenAna }));
  assert.ok(!bruno.json.capsules.some((x) => x.id === selfId));
  assert.ok(!anon.json.capsules.some((x) => x.id === selfId));
  assert.ok(ana.json.capsules.some((x) => x.id === selfId));
  assert.ok(!ana.text.includes("privado"), "nem a autora recebe o texto antes da data");
});

console.log("\nSessão e mural");

await test("Cookie forjado/sem assinatura não autentica", async () => {
  const forged = btoa(encodeURIComponent(JSON.stringify({ userId: "111", username: "Ana" })));
  const r = await call(meGet, req("GET", "/api/auth/me", { token: forged }));
  assert.equal(r.json.authenticated, false);
  const r2 = await call(meGet, req("GET", "/api/auth/me", { token: "a".repeat(64) }));
  assert.equal(r2.json.authenticated, false);
});

await test("Sessão válida autentica; logout a invalida no servidor", async () => {
  const t = await createSession(env, "222");
  assert.equal((await call(meGet, req("GET", "/api/auth/me", { token: t }))).json.authenticated, true);
  assert.equal((await call(logoutPost, req("POST", "/api/auth/logout", { token: t }))).status, 200);
  assert.equal((await call(meGet, req("GET", "/api/auth/me", { token: t }))).json.authenticated, false);
});

await test("Sessão expirada é recusada", async () => {
  const t = await createSession(env, "222");
  env.DB.raw.prepare("UPDATE sessions SET expires_at = ?").run(inSeconds(-10));
  assert.equal((await call(meGet, req("GET", "/api/auth/me", { token: t }))).json.authenticated, false);
  // restaura sessões usadas pelos outros testes
  const novo = await createSession(env, "222");
  globalThis.__tb = novo;
});

await test("Mural: exige login, valida tamanho e lista publicamente", async () => {
  const tb = globalThis.__tb;
  assert.equal((await call(messagesPost, req("POST", "/api/messages", { body: { content: "oi" } }))).status, 401);
  assert.equal((await call(messagesPost, req("POST", "/api/messages", { token: tb, body: { content: "" } }))).status, 400);
  assert.equal((await call(messagesPost, req("POST", "/api/messages", { token: tb, body: { content: "x".repeat(501) } }))).status, 400);
  const ok = await call(messagesPost, req("POST", "/api/messages", { token: tb, body: { content: "<b>Parabéns, turma!</b>" } }));
  assert.equal(ok.status, 201);
  const list = await call(messagesGet, req("GET", "/api/messages"));
  assert.equal(list.json.messages[0].author.name, "Bruno");
  assert.equal(list.json.messages[0].content, "<b>Parabéns, turma!</b>"); // armazenado cru; o front usa textContent
});

await test("POST do mural com JSON malformado retorna 400", async () => {
  const tb = globalThis.__tb;
  const request = new Request(ORIGIN + "/api/messages", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Cookie: `session=${tb}`,
      "Content-Type": "application/json",
    },
    body: "{",
  });
  const r = await call(messagesPost, request);
  assert.equal(r.status, 400);
});

await test("POST do mural com origem cruzada retorna 403", async () => {
  const tb = globalThis.__tb;
  const r = await call(messagesPost, req("POST", "/api/messages", {
    token: tb,
    origin: "https://evil.example",
    body: { content: "tentativa externa" },
  }));
  assert.equal(r.status, 403);
});

console.log(`\n${passed} teste(s) passaram.${process.exitCode ? " HÁ FALHAS." : ""}\n`);
