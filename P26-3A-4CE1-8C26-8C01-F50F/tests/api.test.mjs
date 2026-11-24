import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { hashToken, randomToken } from "../lib/auth.js";
import { onRequest as middleware } from "../functions/api/_middleware.js";
import { onRequest as collections } from "../functions/api/collections.js";
import { onRequest as collection } from "../functions/api/collections/[id].js";
import { onRequest as bookmarks } from "../functions/api/bookmarks.js";
import { onRequest as bookmark } from "../functions/api/bookmarks/[id].js";
import { onRequest as publicCollection } from "../functions/api/public/collections/[id].js";
import { onRequest as publicBookmarks } from "../functions/api/public/collections/[id]/bookmarks.js";
import { onRequest as status } from "../functions/api/status.js";

const origin = "https://bookmark.example";
const users = { a: "123456789012345678", b: "234567890123456789" };
const collectionKeys = ["id", "name", "is_public", "created_at", "updated_at"].sort();
const bookmarkKeys = ["id", "collection_id", "url", "title", "summary", "status", "created_at", "updated_at"].sort();

// As consultas dos handlers e do middleware executam SQLite real, sem disco ou rede.
async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0001_init.sql", "0002_bookmark_manager.sql"]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  function prepare(sql, values = []) {
    return {
      bind(...params) { return prepare(sql, params); },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...values) }; },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  }
  const DB = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const tokens = {};
  for (const [key, userId] of Object.entries(users)) {
    sqlite.prepare("INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)")
      .run(userId, `Pessoa ${key.toUpperCase()}`, "https://example.com/avatar.png");
    tokens[key] = randomToken();
    sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, unixepoch() + 86400)")
      .run(await hashToken(tokens[key]), userId);
  }
  function seedCollection(owner = "a", name = randomUUID(), isPublic = false) {
    const id = randomUUID();
    sqlite.prepare("INSERT INTO collections (id, user_id, name, is_public) VALUES (?, ?, ?, ?)")
      .run(id, users[owner], name, Number(isPublic));
    return id;
  }
  function seedBookmark(owner, collectionId, state = "para_ler", title = randomUUID()) {
    const id = randomUUID();
    sqlite.prepare("INSERT INTO bookmarks (id, user_id, collection_id, url, title, summary, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, users[owner], collectionId, `https://example.com/${id}`, title, "Resumo", state);
    return id;
  }
  async function call(handler, path, options = {}) {
    const { method = "GET", token = tokens.a, body, rawBody, params = {}, headers = {} } = options;
    const requestHeaders = new Headers(headers);
    if (token && !requestHeaders.has("Cookie")) requestHeaders.set("Cookie", `discord_session=${token}`);
    const payload = rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body);
    if (payload !== undefined && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
    const request = new Request(`${origin}${path}`, {
      method, headers: requestHeaders,
      ...(payload === undefined ? {} : { body: payload }),
      ...(payload instanceof ReadableStream ? { duplex: "half" } : {}),
    });
    const context = { request, env: { DB, DISCORD_CLIENT_ID: "test-client" }, params, data: {} };
    context.next = () => handler(context);
    return middleware(context);
  }
  return { sqlite, tokens, call, seedCollection, seedBookmark };
}

function member(path, id) { return { path: `${path}/${id}`, params: { id } }; }
async function error(response, expected) {
  assert.equal(response.status, expected);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const payload = await response.json();
  assert.equal(typeof payload.error.code, "string");
  assert.equal(typeof payload.error.message, "string");
  assert.ok(payload.error.code.length > 0);
  assert.ok(payload.error.message.length > 0);
  return payload;
}
async function data(response, expected = 200) {
  assert.equal(response.status, expected);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ["data"]);
  return payload.data;
}
function validBookmark(collectionId, overrides = {}) {
  return { collection_id: collectionId, url: "https://example.com/article", title: "Artigo técnico", ...overrides };
}

test("coleções: CRUD, publicação booleana, DTO e listagem exclusiva do dono", async (t) => {
  const f = await fixture(t);
  const foreign = f.seedCollection("b", "Coleção de B", true);
  const created = await data(await f.call(collections, "/api/collections", { method: "POST", body: { name: "  Estudos  " } }), 201);
  assert.deepEqual(Object.keys(created).sort(), collectionKeys);
  assert.match(created.id, /^[a-f0-9-]{36}$/i);
  assert.equal(created.name, "Estudos");
  assert.equal(created.is_public, false);
  assert.equal(typeof created.created_at, "number");
  const item = member("/api/collections", created.id);
  assert.deepEqual(await data(await f.call(collection, item.path, { params: item.params })), created);
  const listed = await data(await f.call(collections, "/api/collections"));
  assert.deepEqual(listed.map((row) => row.id), [created.id]);
  assert.ok(!listed.some((row) => row.id === foreign));
  for (const value of [true, false]) {
    const changed = await data(await f.call(collection, item.path, { method: "PATCH", params: item.params, body: { name: "Leituras", is_public: value } }));
    assert.equal(changed.is_public, value);
    assert.equal(changed.name, "Leituras");
  }
  const removed = await f.call(collection, item.path, { method: "DELETE", params: item.params });
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
  await error(await f.call(collection, item.path, { params: item.params }), 404);
});

test("nomes de coleção são únicos por dono e conflitos de PATCH retornam 409", async (t) => {
  const f = await fixture(t);
  f.seedCollection("a", "Mesmo nome");
  const other = f.seedCollection("a", "Outro nome");
  await error(await f.call(collections, "/api/collections", { method: "POST", body: { name: " Mesmo nome " } }), 409);
  await data(await f.call(collections, "/api/collections", { method: "POST", token: f.tokens.b, body: { name: "Mesmo nome" } }), 201);
  await error(await f.call(collection, `/api/collections/${other}`, { method: "PATCH", params: { id: other }, body: { name: "Mesmo nome" } }), 409);
  assert.equal(f.sqlite.prepare("SELECT name FROM collections WHERE id = ?").get(other).name, "Outro nome");
});

test("coleção não vazia retorna 409 e permanece íntegra até remover seus links", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection();
  const link = f.seedBookmark("a", id);
  await error(await f.call(collection, `/api/collections/${id}`, { method: "DELETE", params: { id } }), 409);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM bookmarks WHERE id = ?").get(link).n, 1);
  assert.equal((await f.call(bookmark, `/api/bookmarks/${link}`, { method: "DELETE", params: { id: link } })).status, 204);
  assert.equal((await f.call(collection, `/api/collections/${id}`, { method: "DELETE", params: { id } })).status, 204);
});

test("coleções de outro usuário retornam 404 para leitura, alteração e exclusão", async (t) => {
  const f = await fixture(t);
  const foreign = f.seedCollection("b", "Privada B");
  for (const id of [foreign, randomUUID()]) {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      await error(await f.call(collection, `/api/collections/${id}`, {
        method, params: { id }, ...(method === "PATCH" ? { body: { name: "Invadida" } } : {}),
      }), 404);
    }
  }
  assert.equal(f.sqlite.prepare("SELECT name FROM collections WHERE id = ?").get(foreign).name, "Privada B");
});

test("links: CRUD completo, padrões, mudança de coleção e DTO sem identidade", async (t) => {
  const f = await fixture(t);
  const first = f.seedCollection();
  const second = f.seedCollection();
  const created = await data(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validBookmark(first) }), 201);
  assert.deepEqual(Object.keys(created).sort(), bookmarkKeys);
  assert.equal(created.status, "para_ler");
  assert.equal(created.summary, "");
  const item = member("/api/bookmarks", created.id);
  assert.deepEqual(await data(await f.call(bookmark, item.path, { params: item.params })), created);
  const changed = await data(await f.call(bookmark, item.path, {
    method: "PATCH", params: item.params,
    body: { collection_id: second, title: "Outro título", summary: "Novo resumo", status: "concluido", url: "http://example.com/updated" },
  }));
  assert.equal(changed.collection_id, second);
  assert.equal(changed.title, "Outro título");
  assert.equal(changed.summary, "Novo resumo");
  assert.equal(changed.status, "concluido");
  const removed = await f.call(bookmark, item.path, { method: "DELETE", params: item.params });
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
  await error(await f.call(bookmark, item.path, { params: item.params }), 404);
});

test("links não podem ser criados ou movidos para coleção alheia", async (t) => {
  const f = await fixture(t);
  const own = f.seedCollection();
  const foreign = f.seedCollection("b");
  const ownLink = f.seedBookmark("a", own);
  for (const destination of [foreign, randomUUID()]) {
    await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validBookmark(destination) }), 404);
    await error(await f.call(bookmark, `/api/bookmarks/${ownLink}`, { method: "PATCH", params: { id: ownLink }, body: { collection_id: destination } }), 404);
  }
  assert.equal(f.sqlite.prepare("SELECT collection_id FROM bookmarks WHERE id = ?").get(ownLink).collection_id, own);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n, 1);
});

test("links alheios são 404 inclusive ao tentar movê-los para coleção própria", async (t) => {
  const f = await fixture(t);
  const own = f.seedCollection();
  const foreignCollection = f.seedCollection("b");
  const foreign = f.seedBookmark("b", foreignCollection);
  for (const id of [foreign, randomUUID()]) {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      await error(await f.call(bookmark, `/api/bookmarks/${id}`, {
        method, params: { id }, ...(method === "PATCH" ? { body: { collection_id: own, title: "Invadido" } } : {}),
      }), 404);
    }
  }
  assert.equal(f.sqlite.prepare("SELECT collection_id FROM bookmarks WHERE id = ?").get(foreign).collection_id, foreignCollection);
});

test("filtros privados combinam coleção e status por AND e isolam proprietários", async (t) => {
  const f = await fixture(t);
  const c1 = f.seedCollection();
  const c2 = f.seedCollection();
  const cb = f.seedCollection("b");
  const a = f.seedBookmark("a", c1, "lendo");
  const b = f.seedBookmark("a", c1, "para_ler");
  const c = f.seedBookmark("a", c2, "lendo");
  f.seedBookmark("b", cb, "lendo");
  for (const [query, expected] of [
    ["", [a, b, c]], [`?collection_id=${c1}`, [a, b]], ["?status=lendo", [a, c]],
    [`?collection_id=${c1}&status=lendo`, [a]], [`?collection_id=${c2}&status=concluido`, []],
  ]) {
    const rows = await data(await f.call(bookmarks, `/api/bookmarks${query}`));
    assert.deepEqual(rows.map((row) => row.id).sort(), expected.sort());
  }
  for (const id of [cb, randomUUID()]) await error(await f.call(bookmarks, `/api/bookmarks?collection_id=${id}`), 404);
});

test("listagens de links têm limite padrão 100, aceitam limite menor e rejeitam valores inválidos", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection("a", "Pública", true);
  for (let index = 0; index < 103; index++) f.seedBookmark("a", id);
  for (const [handler, path, params, token] of [
    [bookmarks, "/api/bookmarks", {}, f.tokens.a],
    [publicBookmarks, `/api/public/collections/${id}/bookmarks`, { id }, null],
  ]) {
    assert.equal((await data(await f.call(handler, path, { params, token }))).length, 100);
    assert.equal((await data(await f.call(handler, `${path}?limit=1`, { params, token }))).length, 1);
    for (const limit of ["0", "101", "-1", "1.5", "abc", "1x", ""]) {
      await error(await f.call(handler, `${path}?limit=${limit}`, { params, token }), 400);
    }
  }
});

test("rotas públicas sem login expõem somente a coleção publicada e seus links", async (t) => {
  const f = await fixture(t);
  const published = f.seedCollection("b", "Pública B", true);
  const privateId = f.seedCollection("b", "Privada B");
  const visible = f.seedBookmark("b", published, "lendo");
  f.seedBookmark("b", privateId, "lendo");
  const payload = await data(await f.call(publicCollection, `/api/public/collections/${published}`, { params: { id: published }, token: null }));
  assert.deepEqual(Object.keys(payload).sort(), collectionKeys);
  assert.equal(payload.is_public, true);
  assert.equal(payload.name, "Pública B");
  const rows = await data(await f.call(publicBookmarks, `/api/public/collections/${published}/bookmarks`, { params: { id: published }, token: null }));
  assert.deepEqual(rows.map((row) => row.id), [visible]);
  assert.deepEqual(Object.keys(rows[0]).sort(), bookmarkKeys);
  assert.equal(JSON.stringify({ payload, rows }).includes(users.b), false);
});

test("públicas retornam 404 para privadas/inexistentes e publicação pode ser revogada", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection("a", "Revogável", true);
  f.seedBookmark("a", id);
  await data(await f.call(collection, `/api/collections/${id}`, { method: "PATCH", params: { id }, body: { is_public: false } }));
  for (const target of [id, randomUUID()]) {
    for (const [handler, suffix] of [[publicCollection, ""], [publicBookmarks, "/bookmarks"]]) {
      await error(await f.call(handler, `/api/public/collections/${target}${suffix}`, { params: { id: target }, token: null }), 404);
    }
  }
});

test("coleção pública vazia retorna lista vazia e seu filtro de status é estrito", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection("a", "Pública vazia", true);
  const path = `/api/public/collections/${id}/bookmarks`;
  assert.deepEqual(await data(await f.call(publicBookmarks, path, { params: { id }, token: null })), []);
  const reading = f.seedBookmark("a", id, "lendo");
  f.seedBookmark("a", id, "concluido");
  assert.deepEqual((await data(await f.call(publicBookmarks, `${path}?status=lendo`, { params: { id }, token: null }))).map((row) => row.id), [reading]);
  for (const state of ["", "LENDO", "concluído", "pending"]) {
    await error(await f.call(publicBookmarks, `${path}?status=${encodeURIComponent(state)}`, { params: { id }, token: null }), 400);
    await error(await f.call(bookmarks, `/api/bookmarks?status=${encodeURIComponent(state)}`), 400);
  }
});

test("todas as operações privadas recusam ausência de sessão e sessão expirada", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection();
  const link = f.seedBookmark("a", id);
  const expired = randomToken();
  f.sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, unixepoch() - 7200, unixepoch() - 3600)")
    .run(await hashToken(expired), users.a);
  const operations = [
    [collections, "/api/collections", "GET", {}, undefined],
    [collections, "/api/collections", "POST", {}, { name: "Bloqueada" }],
    [collection, `/api/collections/${id}`, "GET", { id }, undefined],
    [collection, `/api/collections/${id}`, "PATCH", { id }, { name: "Bloqueada" }],
    [collection, `/api/collections/${id}`, "DELETE", { id }, undefined],
    [bookmarks, "/api/bookmarks", "GET", {}, undefined],
    [bookmarks, "/api/bookmarks", "POST", {}, validBookmark(id)],
    [bookmark, `/api/bookmarks/${link}`, "GET", { id: link }, undefined],
    [bookmark, `/api/bookmarks/${link}`, "PATCH", { id: link }, { title: "Bloqueado" }],
    [bookmark, `/api/bookmarks/${link}`, "DELETE", { id: link }, undefined],
  ];
  for (const token of [null, expired]) {
    for (const [handler, path, method, params, body] of operations) await error(await f.call(handler, path, { method, params, body, token }), 401);
  }
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM collections").get().n, 1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n, 1);
});

test("métodos inválidos retornam 405 e Allow correto nas seis rotas", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection("a", "Métodos", true);
  const link = f.seedBookmark("a", id);
  for (const [handler, path, params, allowed] of [
    [collections, "/api/collections", {}, ["GET", "POST"]],
    [collection, `/api/collections/${id}`, { id }, ["GET", "PATCH", "DELETE"]],
    [bookmarks, "/api/bookmarks", {}, ["GET", "POST"]],
    [bookmark, `/api/bookmarks/${link}`, { id: link }, ["GET", "PATCH", "DELETE"]],
    [publicCollection, `/api/public/collections/${id}`, { id }, ["GET"]],
    [publicBookmarks, `/api/public/collections/${id}/bookmarks`, { id }, ["GET"]],
  ]) {
    const response = await f.call(handler, path, { method: "PUT", params });
    assert.deepEqual(response.headers.get("Allow")?.split(",").map((method) => method.trim()).sort(), allowed.sort());
    await error(response, 405);
  }
});

test("Origin externo bloqueia todas as escritas sem alterar registros", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection("a", "Original");
  const link = f.seedBookmark("a", id, "para_ler", "Original");
  for (const [handler, path, method, params, body] of [
    [collections, "/api/collections", "POST", {}, { name: "Externa" }],
    [collection, `/api/collections/${id}`, "PATCH", { id }, { name: "Externa" }],
    [collection, `/api/collections/${id}`, "DELETE", { id }, undefined],
    [bookmarks, "/api/bookmarks", "POST", {}, validBookmark(id)],
    [bookmark, `/api/bookmarks/${link}`, "PATCH", { id: link }, { title: "Externo" }],
    [bookmark, `/api/bookmarks/${link}`, "DELETE", { id: link }, undefined],
  ]) await error(await f.call(handler, path, { method, params, body, headers: { Origin: "https://externo.example" } }), 403);
  assert.equal(f.sqlite.prepare("SELECT name FROM collections WHERE id = ?").get(id).name, "Original");
  assert.equal(f.sqlite.prepare("SELECT title FROM bookmarks WHERE id = ?").get(link).title, "Original");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n, 1);
});

test("coleções validam tipos, limites e campos proibidos; PATCH vazio é inválido", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection();
  for (const body of [
    null, [], {}, { name: "" }, { name: "   " }, { name: "a".repeat(81) }, { name: 42 },
    { name: "A", is_public: 1 }, { name: "A", is_public: "true" }, { name: "A", is_public: null },
    { name: "A", user_id: users.b }, { name: "A", id: randomUUID() },
    { name: "A", created_at: 0 }, { name: "A", updated_at: 0 }, { name: "A", unknown: true },
  ]) await error(await f.call(collections, "/api/collections", { method: "POST", body }), 400);
  await error(await f.call(collection, `/api/collections/${id}`, { method: "PATCH", params: { id }, body: {} }), 400);
});

test("links validam URL, conteúdo, status e recusam identidade e timestamps do cliente", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection();
  for (const changes of [
    { url: "" }, { url: "/relative" }, { url: "javascript:alert(1)" }, { url: "data:text/plain,oi" },
    { url: "ftp://example.com/file" }, { url: "https://user:password@example.com/a" },
    { url: "https://example.com/\narticle" }, { url: "https://example.com/" + "a".repeat(2048) },
    { url: null }, { title: "" }, { title: "   " }, { title: "a".repeat(201) }, { title: 42 },
    { summary: null }, { summary: 123 }, { summary: "a".repeat(2001) },
    { status: "LENDO" }, { status: "concluído" }, { status: null }, { collection_id: null },
    { user_id: users.b }, { id: randomUUID() }, { created_at: 0 }, { updated_at: 0 }, { unknown: true },
  ]) await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validBookmark(id, changes) }), 400);
  for (const body of [null, [], {}, { collection_id: id, title: "Sem URL" }]) {
    await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body }), 400);
  }
  const link = f.seedBookmark("a", id);
  await error(await f.call(bookmark, `/api/bookmarks/${link}`, { method: "PATCH", params: { id: link }, body: {} }), 400);
  for (const body of [{ user_id: users.b }, { id: randomUUID() }, { updated_at: 0 }, { status: "pendente" }]) {
    await error(await f.call(bookmark, `/api/bookmarks/${link}`, { method: "PATCH", params: { id: link }, body }), 400);
  }
});

test("UUIDs inválidos falham em detalhes, rotas públicas, criação e filtro", async (t) => {
  const f = await fixture(t);
  for (const id of ["invalid", "1", "' OR 1=1 --"]) {
    for (const [handler, prefix, suffix] of [
      [collection, "/api/collections", ""], [bookmark, "/api/bookmarks", ""],
      [publicCollection, "/api/public/collections", ""], [publicBookmarks, "/api/public/collections", "/bookmarks"],
    ]) await error(await f.call(handler, `${prefix}/${encodeURIComponent(id)}${suffix}`, { params: { id } }), 400);
    await error(await f.call(bookmarks, `/api/bookmarks?collection_id=${encodeURIComponent(id)}`), 400);
    await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validBookmark(id) }), 400);
  }
});

test("JSON malformado é 400, mídia incompatível é 415 e charset JSON é aceito", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection();
  for (const [handler, path, body] of [[collections, "/api/collections", { name: "Com charset" }], [bookmarks, "/api/bookmarks", validBookmark(id)]]) {
    await error(await f.call(handler, path, { method: "POST", rawBody: "{invalid" }), 400);
    await error(await f.call(handler, path, { method: "POST", rawBody: "" }), 400);
    await error(await f.call(handler, path, { method: "POST", body, headers: { "Content-Type": "text/plain" } }), 415);
    await data(await f.call(handler, path, { method: "POST", body, headers: { "Content-Type": "application/json; charset=utf-8", Origin: origin } }), 201);
  }
});

test("limite real de 32768 bytes aceita fronteira e rejeita UTF-8 grande mesmo com Content-Length falso", async (t) => {
  const f = await fixture(t);
  const base = JSON.stringify({ name: "Na fronteira" });
  await data(await f.call(collections, "/api/collections", { method: "POST", rawBody: base + " ".repeat(32768 - Buffer.byteLength(base)) }), 201);
  await error(await f.call(collections, "/api/collections", {
    method: "POST", rawBody: JSON.stringify({ name: "💡".repeat(9000) }), headers: { "Content-Length": "1" },
  }), 413);
  const id = f.seedCollection();
  await error(await f.call(collection, `/api/collections/${id}`, {
    method: "PATCH", params: { id }, rawBody: JSON.stringify({ name: "💡".repeat(9000) }),
  }), 413);
});

test("corpo em streaming acima do limite é rejeitado sem criar link", async (t) => {
  const f = await fixture(t);
  const id = f.seedCollection();
  const prefix = JSON.stringify(validBookmark(id));
  const chunks = [prefix, " ".repeat(17000), " ".repeat(17000)];
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(chunk));
    },
  });
  await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", rawBody: stream, headers: { "Content-Length": "1" } }), 413);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n, 0);
});

test("valores com sintaxe SQL são dados literais e não alteram o esquema", async (t) => {
  const f = await fixture(t);
  const name = "Robert'); DROP TABLE bookmarks; --";
  const created = await data(await f.call(collections, "/api/collections", { method: "POST", body: { name } }), 201);
  assert.equal(created.name, name);
  const title = "' OR 1=1; DROP TABLE collections; --";
  const saved = await data(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validBookmark(created.id, { title }) }), 201);
  assert.equal(saved.title, title);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM collections").get().n, 1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n, 1);
});

test("GET status preserva diagnóstico, mas nunca expõe perfil nem registros", async (t) => {
  const f = await fixture(t);
  f.sqlite.prepare("INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)")
    .run(users.b, "Privado", "P26-3A-4CE1-8C26-8C01-F50F", "Conteúdo privado");
  const forged = btoa(encodeURIComponent(JSON.stringify({ userId: users.b, username: "Forjado", avatar: "private" })));
  for (const options of [{ token: null }, { token: f.tokens.a }, { token: null, headers: { Cookie: `discord_session=${forged}` } }]) {
    const response = await f.call(status, "/api/status", options);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["ok", "chave", "projectId", "projectTitle", "d1Connected", "discordOAuthConfigured", "sessionUser", "totalRegistros", "ultimosRegistros", "serverTimestamp"].sort());
    assert.equal(body.sessionUser, null);
    assert.deepEqual(body.ultimosRegistros, []);
    assert.equal(body.totalRegistros, 1);
    assert.equal(body.d1Connected, true);
    assert.equal(JSON.stringify(body).includes("Conteúdo privado"), false);
    assert.equal(JSON.stringify(body).includes(users.b), false);
  }
});
