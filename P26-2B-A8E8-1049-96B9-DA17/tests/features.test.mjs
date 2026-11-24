// Tags, importação e coleções: roda contra SQLite real (node:sqlite) com as migrations do projeto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { signSession } from "../functions/_lib/session.js";
import * as create from "../functions/api/quotes/index.js";
import * as byId from "../functions/api/quotes/[id].js";
import * as mine from "../functions/api/quotes/mine.js";
import * as feed from "../functions/api/quotes/feed.js";
import * as imp from "../functions/api/quotes/import.js";
import * as tags from "../functions/api/tags.js";
import * as cols from "../functions/api/collections/index.js";
import * as colById from "../functions/api/collections/[id].js";
import * as colQuotes from "../functions/api/collections/[id]/quotes.js";

const ORIGIN = "https://acervo.example";
const SECRET = "segredo-de-teste";

function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
  const exec = (sql, args, mode) => {
    const st = db.prepare(sql);
    if (mode === "all") return st.all(...args);
    const r = st.run(...args);
    return { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) };
  };
  const stmt = (sql, args = []) => ({
    sql, args,
    bind: (...a) => stmt(sql, a),
    run: async () => ({ meta: exec(sql, args, "run") }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    async batch(list) {
      db.exec("BEGIN");
      try {
        const out = list.map((s) => ({ meta: exec(s.sql, s.args, "run") }));
        db.exec("COMMIT");
        return out;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

const mkEnv = () => ({ DB: sqliteD1(), SESSION_SECRET: SECRET });
const cookieFor = async (userId) => `discord_session=${await signSession({ userId, username: userId, avatar: null }, SECRET)}`;
const req = (path, { method = "GET", cookie, body } = {}) =>
  new Request(ORIGIN + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const call = (mod, request, env, params = {}) => mod.onRequest({ request, env, params });
const post = async (env, cookie, body) => call(create, req("/api/quotes", { method: "POST", cookie, body }), env);

test("tags: normaliza, devolve no objeto, PUT substitui, omitir mantém", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  let r = await post(env, a, { text: "t", author: "x", tags: ["#Filosofia", " vida ", "filosofia", "ação_2"] });
  assert.equal(r.status, 201);
  const q = (await r.json()).quote;
  assert.deepEqual(q.tags, ["ação_2", "filosofia", "vida"]);
  assert.deepEqual(q.collectionIds, []);
  r = await post(env, a, { text: "sem", author: "x" });
  assert.deepEqual((await r.json()).quote.tags, []);

  const id = String(q.id);
  r = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { text: "t2", author: "x" } }), env, { id });
  assert.deepEqual((await r.json()).quote.tags, ["ação_2", "filosofia", "vida"]); // omitido => mantém
  r = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { text: "t2", author: "x", tags: ["novo"] } }), env, { id });
  assert.deepEqual((await r.json()).quote.tags, ["novo"]);
  r = await call(byId, req("/api/quotes/" + id, { method: "PUT", cookie: a, body: { text: "t2", author: "x", tags: [] } }), env, { id });
  assert.deepEqual((await r.json()).quote.tags, []);
});

test("tags inválidas => 400 com fields.tags", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const bad = [
    "texto", [1], ["a b"], ["a/b"], [""], ["#"], ["x".repeat(31)], ["<script>"],
    ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"],
  ];
  for (const tags of bad) {
    const r = await post(env, a, { text: "t", author: "x", tags });
    assert.equal(r.status, 400, JSON.stringify(tags));
    assert.ok((await r.json()).fields.tags);
  }
  // 8 tags e 30 chars são aceitos
  const ok = await post(env, a, { text: "t", author: "x", tags: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "x".repeat(30)] });
  assert.equal(ok.status, 201);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM quotes").get().c, 1); // nada gravado nas inválidas
});

test("?tag= em mine e feed; /api/tags só do usuário", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const b = await cookieFor("B");
  await post(env, a, { text: "1", author: "x", tags: ["vida", "arte"], visibility: "public" });
  await post(env, a, { text: "2", author: "x", tags: ["vida"] });
  await post(env, b, { text: "3", author: "x", tags: ["vida", "outra"], visibility: "public" });
  const m = await (await call(mine, req("/api/quotes/mine?tag=%23VIDA", { cookie: a }), env)).json();
  assert.deepEqual(m.quotes.map((q) => q.text), ["2", "1"]);
  const f = await (await call(feed, req("/api/quotes/feed?tag=vida", { cookie: a }), env)).json();
  assert.deepEqual(f.quotes.map((q) => q.text), ["3", "1"]);
  assert.deepEqual(f.quotes[0].tags, ["outra", "vida"]);
  assert.deepEqual(f.quotes[0].collectionIds, []);
  assert.equal((await call(mine, req("/api/quotes/mine?tag=a%20b", { cookie: a }), env)).status, 400);
  const t = await (await call(tags, req("/api/tags", { cookie: a }), env)).json();
  assert.deepEqual(t, { ok: true, tags: [{ tag: "vida", count: 2 }, { tag: "arte", count: 1 }] });
  assert.equal((await call(tags, req("/api/tags"), env)).status, 401);
  assert.equal((await call(tags, req("/api/tags", { method: "POST", cookie: a, body: {} }), env)).status, 405);
});

test("excluir citação remove tags (cascata)", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const q = (await (await post(env, a, { text: "1", author: "x", tags: ["vida"] })).json()).quote;
  const id = String(q.id);
  await call(byId, req("/api/quotes/" + id, { method: "DELETE", cookie: a }), env, { id });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM quote_tags").get().c, 0);
});

test("import: privado, duplicata (banco e lote), inválido, tags", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  await post(env, a, { text: "Já existe", author: "Fulano", visibility: "public" });
  const items = [
    { text: "Novo 1", author: "Autor", tags: ["#Lido"], visibility: "public", isPublic: true },
    { text: "  já   EXISTE ", author: "fulano" },           // dup do banco (normalizado)
    { text: "Novo 1", author: "AUTOR" },                    // dup no lote
    { text: "", author: "x" },                              // inválido
    { text: "ok", author: "x", tags: ["a b"] },             // tag inválida
    "lixo",                                                 // não é objeto
    { text: "Novo 2", author: "Autor", work: "Obra", page: "7", reflection: "r" },
  ];
  const r = await call(imp, req("/api/quotes/import", { method: "POST", cookie: a, body: { items } }), env);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.created, 2);
  assert.deepEqual(j.skipped.map((s) => [s.index, s.reason]), [[1, "duplicate"], [2, "duplicate"], [3, "invalid"], [4, "invalid"], [5, "invalid"]]);
  assert.ok(j.skipped[2].fields.text && j.skipped[3].fields.tags);
  assert.ok(j.quotes.every((q) => q.visibility === "private" && q.owner.userId === "A"));
  assert.deepEqual(j.quotes.map((q) => q.text), ["Novo 1", "Novo 2"]);
  assert.deepEqual(j.quotes[0].tags, ["lido"]);
  assert.equal(j.quotes[1].page, 7);
  // reimportar tudo => tudo duplicado
  const again = await (await call(imp, req("/api/quotes/import", { method: "POST", cookie: a, body: { items: items.slice(0, 1) } }), env)).json();
  assert.equal(again.created, 0);
  assert.equal(again.skipped[0].reason, "duplicate");
  // outro usuário pode importar o mesmo texto
  const b = await cookieFor("B");
  const rb = await (await call(imp, req("/api/quotes/import", { method: "POST", cookie: b, body: { items: items.slice(0, 1) } }), env)).json();
  assert.equal(rb.created, 1);
});

test("import: limites (200 itens, vazio, corpo > 1 MB), auth e origem", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ text: "t" + i, author: "a" }));
  let r = await call(imp, req("/api/quotes/import", { method: "POST", cookie: a, body: { items: mk(200) } }), env);
  assert.equal((await r.json()).created, 200);
  r = await call(imp, req("/api/quotes/import", { method: "POST", cookie: a, body: { items: mk(201) } }), env);
  assert.equal(r.status, 400);
  assert.ok((await r.json()).fields.items);
  for (const body of [{ items: [] }, { items: "x" }, {}]) {
    assert.equal((await call(imp, req("/api/quotes/import", { method: "POST", cookie: a, body }), env)).status, 400);
  }
  const big = { items: [{ text: "x", author: "y", reflection: "z".repeat(1024 * 1024) }] };
  assert.equal((await call(imp, req("/api/quotes/import", { method: "POST", cookie: a, body: big }), env)).status, 413);
  assert.equal((await call(imp, req("/api/quotes/import", { method: "POST", body: { items: mk(1) } }), env)).status, 401);
  assert.equal((await call(imp, req("/api/quotes/import", { cookie: a }), env)).status, 405);
  const evil = new Request(ORIGIN + "/api/quotes/import", { method: "POST", headers: { Cookie: a, "Content-Type": "application/json", Origin: "https://evil.example" }, body: '{"items":[]}' });
  assert.equal((await call(imp, evil, env)).status, 403);
});

test("coleções: CRUD, 409, membros, filtro ?collection=, collectionIds só do dono", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const mkq = async (t, extra = {}) => (await (await post(env, a, { text: t, author: "x", ...extra })).json()).quote;
  const q1 = await mkq("1", { visibility: "public" });
  const q2 = await mkq("2");
  await mkq("3");

  let r = await call(cols, req("/api/collections", { method: "POST", cookie: a, body: { name: "  Favoritas " } }), env);
  assert.equal(r.status, 201);
  const col = (await r.json()).collection;
  assert.deepEqual(col, { id: col.id, name: "Favoritas", count: 0 });
  r = await call(cols, req("/api/collections", { method: "POST", cookie: a, body: { name: "Favoritas" } }), env);
  assert.equal(r.status, 409);
  for (const name of ["", "   ", 5, "x".repeat(61)]) {
    assert.equal((await call(cols, req("/api/collections", { method: "POST", cookie: a, body: { name } }), env)).status, 400);
  }

  const cid = String(col.id);
  r = await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", cookie: a, body: { quoteIds: [q1.id, q2.id, q1.id] } }), env, { id: cid });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).collection.count, 2);
  let list = await (await call(cols, req("/api/collections", { cookie: a }), env)).json();
  assert.deepEqual(list.collections, [{ id: col.id, name: "Favoritas", count: 2 }]);

  const m = await (await call(mine, req(`/api/quotes/mine?collection=${cid}`, { cookie: a }), env)).json();
  assert.deepEqual(m.quotes.map((q) => q.text), ["2", "1"]);
  assert.deepEqual(m.quotes[0].collectionIds, [col.id]);
  const all = await (await call(mine, req("/api/quotes/mine", { cookie: a }), env)).json();
  assert.equal(all.quotes.length, 3);
  assert.equal((await call(mine, req("/api/quotes/mine?collection=abc", { cookie: a }), env)).status, 400);

  // outro usuário vê a citação pública sem collectionIds
  const b = await cookieFor("B");
  const f = await (await call(feed, req("/api/quotes/feed", { cookie: b }), env)).json();
  assert.deepEqual(f.quotes[0].collectionIds, []);

  // substituir membros
  r = await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", cookie: a, body: { quoteIds: [q2.id] } }), env, { id: cid });
  assert.equal((await r.json()).collection.count, 1);
  await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", cookie: a, body: { quoteIds: [] } }), env, { id: cid });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM collection_quotes").get().c, 0);
  await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", cookie: a, body: { quoteIds: [q1.id] } }), env, { id: cid });

  // renomear (e conflito)
  await call(cols, req("/api/collections", { method: "POST", cookie: a, body: { name: "Outra" } }), env);
  r = await call(colById, req(`/api/collections/${cid}`, { method: "PUT", cookie: a, body: { name: "Outra" } }), env, { id: cid });
  assert.equal(r.status, 409);
  r = await call(colById, req(`/api/collections/${cid}`, { method: "PUT", cookie: a, body: { name: "Renomeada" } }), env, { id: cid });
  assert.deepEqual((await r.json()).collection, { id: col.id, name: "Renomeada", count: 1 });

  // excluir coleção não apaga citações
  r = await call(colById, req(`/api/collections/${cid}`, { method: "DELETE", cookie: a }), env, { id: cid });
  assert.equal(r.status, 200);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM quotes").get().c, 3);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM collection_quotes").get().c, 0);
  // excluir citação some da coleção (cascata)
  const c2 = (await (await call(cols, req("/api/collections", { cookie: a }), env)).json()).collections[0];
  await call(colQuotes, req(`/api/collections/${c2.id}/quotes`, { method: "PUT", cookie: a, body: { quoteIds: [q1.id] } }), env, { id: String(c2.id) });
  await call(byId, req("/api/quotes/" + q1.id, { method: "DELETE", cookie: a }), env, { id: String(q1.id) });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM collection_quotes").get().c, 0);
});

test("coleções: dono errado 403, inexistente 404, citação alheia 400, 401 sem sessão", async () => {
  const env = mkEnv();
  const a = await cookieFor("A");
  const b = await cookieFor("B");
  const col = (await (await call(cols, req("/api/collections", { method: "POST", cookie: a, body: { name: "Minha" } }), env)).json()).collection;
  const cid = String(col.id);
  const qa = (await (await post(env, a, { text: "a", author: "x" })).json()).quote;
  const qb = (await (await post(env, b, { text: "b", author: "x" })).json()).quote;

  assert.equal((await call(colById, req(`/api/collections/${cid}`, { method: "PUT", cookie: b, body: { name: "Roubada" } }), env, { id: cid })).status, 403);
  assert.equal((await call(colById, req(`/api/collections/${cid}`, { method: "DELETE", cookie: b }), env, { id: cid })).status, 403);
  assert.equal((await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", cookie: b, body: { quoteIds: [qb.id] } }), env, { id: cid })).status, 403);
  assert.equal((await call(colById, req("/api/collections/999", { method: "DELETE", cookie: a }), env, { id: "999" })).status, 404);
  assert.equal((await call(colById, req("/api/collections/abc", { method: "DELETE", cookie: a }), env, { id: "abc" })).status, 404);
  assert.equal((await call(colQuotes, req("/api/collections/999/quotes", { method: "PUT", cookie: a, body: { quoteIds: [] } }), env, { id: "999" })).status, 404);
  // citação de outro usuário / inexistente / ids inválidos
  for (const quoteIds of [[qb.id], [99999], ["x"], [-1], [1.5], "nope"]) {
    const r = await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", cookie: a, body: { quoteIds } }), env, { id: cid });
    assert.equal(r.status, 400, JSON.stringify(quoteIds));
    assert.ok((await r.json()).fields.quoteIds);
  }
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM collection_quotes").get().c, 0);
  // listagem só mostra as do usuário
  const lb = await (await call(cols, req("/api/collections", { cookie: b }), env)).json();
  assert.deepEqual(lb.collections, []);
  // mesmo nome em outro usuário é permitido
  assert.equal((await call(cols, req("/api/collections", { method: "POST", cookie: b, body: { name: "Minha" } }), env)).status, 201);

  assert.equal((await call(cols, req("/api/collections"), env)).status, 401);
  assert.equal((await call(cols, req("/api/collections", { method: "POST", body: { name: "x" } }), env)).status, 401);
  assert.equal((await call(colById, req(`/api/collections/${cid}`, { method: "DELETE" }), env, { id: cid })).status, 401);
  assert.equal((await call(colQuotes, req(`/api/collections/${cid}/quotes`, { method: "PUT", body: { quoteIds: [qa.id] } }), env, { id: cid })).status, 401);
  assert.equal((await call(cols, req("/api/collections", { method: "DELETE", cookie: a }), env)).status, 405);
});
