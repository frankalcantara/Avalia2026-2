import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { hashToken, randomToken } from "../lib/auth.js";
import { onRequest as middleware } from "../functions/api/_middleware.js";
import { onRequest as collections } from "../functions/api/collections.js";
import { onRequest as collection } from "../functions/api/collections/[id].js";
import { onRequest as bookmarks } from "../functions/api/bookmarks.js";
import { onRequest as bookmark } from "../functions/api/bookmarks/[id].js";
import { onRequest as publicCollection } from "../functions/api/public/collections/[id].js";
import { onRequest as publicBookmarks } from "../functions/api/public/collections/[id]/bookmarks.js";
import { onRequest as status } from "../functions/api/status.js";
import { onRequestGet as me } from "../functions/api/auth/me.js";
import { onRequestPost as logout } from "../functions/api/auth/logout.js";

// Auditoria local: sem rede, sem subprocessos e sem escrita pelo teste.
// As únicas bases abertas são SQLite :memory:, com as migrações reais.
const root = resolve(import.meta.dirname, "..");
const origin = "https://bookmark.example";
const users = { a: "123456789012345678", b: "234567890123456789" };
const key = "P26-3A-4CE1-8C26-8C01-F50F";
const read = (path) => readFileSync(resolve(root, path), "utf8");

async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0001_init.sql", "0002_bookmark_manager.sql"]) sqlite.exec(read(`migrations/${name}`));
  const trace = [];
  function prepare(sql, values = []) {
    function statement() { trace.push({ sql, values }); return sqlite.prepare(sql); }
    return {
      bind(...args) { return prepare(sql, args); },
      async first() { return statement().get(...values) || null; },
      async all() { return { success: true, results: statement().all(...values) }; },
      async run() { return { success: true, meta: { changes: Number(statement().run(...values).changes) } }; },
    };
  }
  const DB = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const item of statements) result.push(await item.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const tokens = {};
  for (const [owner, id] of Object.entries(users)) {
    sqlite.prepare("INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)")
      .run(id, `Pessoa ${owner}`, "https://cdn.discordapp.com/embed/avatars/0.png");
    tokens[owner] = randomToken();
    sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, unixepoch() + 86400)")
      .run(await hashToken(tokens[owner]), id);
  }
  const expired = randomToken();
  sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, unixepoch() - 7200, unixepoch() - 3600)")
    .run(await hashToken(expired), users.a);
  function seedCollection(owner = "a", isPublic = false) {
    const id = randomUUID();
    sqlite.prepare("INSERT INTO collections (id, user_id, name, is_public) VALUES (?, ?, ?, ?)")
      .run(id, users[owner], `Coleção ${id}`, Number(isPublic));
    return id;
  }
  function seedBookmark(owner, collectionId) {
    const id = randomUUID();
    sqlite.prepare("INSERT INTO bookmarks (id, user_id, collection_id, url, title, summary) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, users[owner], collectionId, "https://example.com/artigo", "Original", "Resumo original");
    return id;
  }
  function snapshot() {
    return JSON.stringify(["collections", "bookmarks", "project_records", "auth_sessions", "discord_users"]
      .map(table => sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()));
  }
  async function call(handler, path, options = {}) {
    const { method = "GET", token = tokens.a, body, rawBody, params = {}, headers = {}, autoContentType = true } = options;
    const requestHeaders = new Headers(headers);
    if (token && !requestHeaders.has("Cookie")) requestHeaders.set("Cookie", `discord_session=${token}`);
    const payload = rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body);
    if (payload !== undefined && autoContentType && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
    const request = new Request(`${origin}${path}`, {
      method, headers: requestHeaders,
      ...(payload === undefined ? {} : { body: payload }),
      ...(payload instanceof ReadableStream ? { duplex: "half" } : {}),
    });
    const context = { request, env: { DB, DISCORD_CLIENT_ID: "qa-client" }, params, data: {} };
    context.next = () => handler(context);
    return middleware(context);
  }
  return { sqlite, trace, tokens, expired, seedCollection, seedBookmark, snapshot, call };
}

function validLink(collectionId, changes = {}) {
  return { url: "https://example.com/artigo", title: "Artigo", summary: "Resumo", collection_id: collectionId, ...changes };
}
async function error(response, expected, label = "") {
  assert.equal(response.status, expected, label);
  assert.equal(response.headers.get("Cache-Control"), "no-store", label);
  const payload = await response.json();
  assert.equal(typeof payload.error.code, "string", label);
  assert.equal(typeof payload.error.message, "string", label);
  return payload.error;
}
async function data(response, expected = 200) {
  assert.equal(response.status, expected);
  return (await response.json()).data;
}
function writes(collectionId, bookmarkId) {
  return [
    [collections, "/api/collections", "POST", {}, { name: "Nova" }],
    [collection, `/api/collections/${collectionId}`, "PATCH", { id: collectionId }, { name: "Alterada" }],
    [collection, `/api/collections/${collectionId}`, "DELETE", { id: collectionId }, undefined],
    [bookmarks, "/api/bookmarks", "POST", {}, validLink(collectionId)],
    [bookmark, `/api/bookmarks/${bookmarkId}`, "PATCH", { id: bookmarkId }, { title: "Alterado" }],
    [bookmark, `/api/bookmarks/${bookmarkId}`, "DELETE", { id: bookmarkId }, undefined],
  ];
}

for (const [caseId, kind, method] of [
  ["QA01", "collection", "PATCH"], ["QA02", "collection", "DELETE"],
  ["QA03", "bookmark", "PATCH"], ["QA04", "bookmark", "DELETE"],
]) {
  test(`${caseId}: ID alheio em ${method} ${kind} retorna 404 e não altera dados`, async (t) => {
    const f = await fixture(t);
    const own = f.seedCollection();
    const foreign = f.seedCollection("b");
    const foreignLink = f.seedBookmark("b", foreign);
    const id = kind === "collection" ? foreign : foreignLink;
    const before = f.snapshot();
    const body = method === "PATCH" ? kind === "collection" ? { name: "Invadida", is_public: true }
      : { title: "Invadido", collection_id: own } : undefined;
    await error(await f.call(kind === "collection" ? collection : bookmark,
      `/api/${kind === "collection" ? "collections" : "bookmarks"}/${id}`, { method, params: { id }, body }), 404);
    assert.equal(f.snapshot(), before);
  });
}

test("QA05: criar ou mover link para coleção alheia/inexistente é atômico e retorna 404", async (t) => {
  const f = await fixture(t);
  const own = f.seedCollection();
  const foreign = f.seedCollection("b");
  const id = f.seedBookmark("a", own);
  const before = f.snapshot();
  for (const destination of [foreign, randomUUID()]) {
    await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validLink(destination) }), 404);
    await error(await f.call(bookmark, `/api/bookmarks/${id}`, {
      method: "PATCH", params: { id }, body: { collection_id: destination, title: "Não gravar parcialmente" },
    }), 404);
  }
  assert.equal(f.snapshot(), before);
});

test("QA06: URLs executáveis, credenciais e controles são recusados em POST e PATCH", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  for (const url of [
    "javascript:alert(document.domain)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>",
    "https://user:password@example.com/", "https://user@example.com/", "https://%75ser:%70ass@example.com/",
    "https://example.com/\nscript", "//example.com/relative", "file:///etc/passwd",
  ]) {
    await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validLink(col, { url }) }), 400, url);
    await error(await f.call(bookmark, `/api/bookmarks/${id}`, { method: "PATCH", params: { id }, body: { url } }), 400, url);
  }
  assert.equal(f.snapshot(), before);
});

test("QA07: status inválido é recusado em criação, edição e filtros privados/públicos", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection("a", true);
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  for (const invalid of ["pendente", "LENDO", "concluído", "", null, 1, {}, ["lendo"]]) {
    await error(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validLink(col, { status: invalid }) }), 400);
    await error(await f.call(bookmark, `/api/bookmarks/${id}`, { method: "PATCH", params: { id }, body: { status: invalid } }), 400);
    const encoded = encodeURIComponent(typeof invalid === "string" ? invalid : JSON.stringify(invalid));
    await error(await f.call(bookmarks, `/api/bookmarks?status=${encoded}`), 400);
    await error(await f.call(publicBookmarks, `/api/public/collections/${col}/bookmarks?status=${encoded}`, { params: { id: col }, token: null }), 400);
  }
  assert.equal(f.snapshot(), before);
});

test("QA08: campos extras/identidade/timestamps/protótipo não passam por POST ou PATCH", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  for (const field of ["user_id", "userId", "id", "created_at", "updated_at", "role", "is_admin", "__proto__", "$where", "name = 'invadido' --"]) {
    for (const [handler, path, method, params, body] of writes(col, id).filter(item => item[2] !== "DELETE")) {
      const failure = await error(await f.call(handler, path, { method, params, body: { ...body, [field]: users.b } }), 400, field);
      assert.equal(failure.code, "unknown_fields");
      assert.ok(Object.hasOwn(failure.fields, field));
    }
  }
  assert.equal(f.snapshot(), before);
});

test("QA09: 32769 bytes, UTF-8 e Content-Length mentiroso não contornam 32 KiB", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  for (const [handler, path, method, params, body] of writes(col, id).filter(item => item[2] !== "DELETE")) {
    const base = JSON.stringify(body);
    for (const rawBody of [base + " ".repeat(32769 - Buffer.byteLength(base)), JSON.stringify({ ...body, padding: "💡".repeat(9000) })]) {
      for (const headers of [{}, { "Content-Length": "1" }]) {
        await error(await f.call(handler, path, { method, params, rawBody, headers }), 413);
      }
    }
  }
  assert.equal(f.snapshot(), before);
  const base = JSON.stringify({ name: "Exatamente 32 KiB" });
  await data(await f.call(collections, "/api/collections", {
    method: "POST", rawBody: base + " ".repeat(32768 - Buffer.byteLength(base)),
  }), 201);
});

test("QA10: streaming acima de 32 KiB é cancelado antes de gravar em POST/PATCH", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  for (const [handler, path, method, params, body] of writes(col, id).filter(item => item[2] !== "DELETE")) {
    const chunks = [JSON.stringify(body), " ".repeat(17000), " ".repeat(17000), " ".repeat(200)];
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk === undefined) controller.close();
        else controller.enqueue(new TextEncoder().encode(chunk));
      },
      cancel() { cancelled = true; },
    });
    await error(await f.call(handler, path, { method, params, rawBody: stream, headers: { "Content-Length": "1" } }), 413);
    assert.equal(cancelled, true);
  }
  assert.equal(f.snapshot(), before);
});

test("QA11: Content-Type errado ou ausente retorna 415 em todos os POST/PATCH do CRUD", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  for (const [handler, path, method, params, body] of writes(col, id).filter(item => item[2] !== "DELETE")) {
    for (const mediaType of ["text/plain", "application/x-www-form-urlencoded", "application/jsonp", "text/json", "", null]) {
      await error(await f.call(handler, path, {
        method, params, rawBody: new TextEncoder().encode(JSON.stringify(body)), autoContentType: false,
        headers: mediaType === null ? {} : { "Content-Type": mediaType },
      }), 415);
    }
  }
  assert.equal(f.snapshot(), before);
});

test("QA12: Origin falso bloqueia CRUD, diagnóstico e logout, preservando dados e sessão", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  const operations = [...writes(col, id), [status, "/api/status", "POST", {}, { conteudo: "Externo" }], [logout, "/api/auth/logout", "POST", {}, undefined]];
  for (const invalid of ["https://attacker.invalid", `${origin}.attacker.invalid`, `${origin}:444`, "null", `${origin}/`]) {
    for (const [handler, path, method, params, body] of operations) {
      const response = await f.call(handler, path, { method, params, body, headers: { Origin: invalid } });
      assert.equal(response.status, 403, `${method} ${path}: ${invalid}`);
    }
  }
  assert.equal(f.snapshot(), before);
  await data(await f.call(bookmark, `/api/bookmarks/${id}`, { method: "PATCH", params: { id }, body: { title: "Mesma origem" }, headers: { Origin: origin } }));
});

test("QA13: cookies forjados, alterados, duplicados e expirados não autenticam nenhuma rota privada", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection();
  const id = f.seedBookmark("a", col);
  const before = f.snapshot();
  const forged = Buffer.from(JSON.stringify({ user_id: users.a, username: "Admin", is_admin: true })).toString("base64");
  const altered = (f.tokens.a[0] === "a" ? "b" : "a") + f.tokens.a.slice(1);
  const cookies = ["", `discord_session=${forged}`, `discord_session=${randomToken()}`, `discord_session=${altered}`,
    `discord_session=${f.expired}`, `discord_session=${f.tokens.a}; discord_session=${f.tokens.a}`, `xdiscord_session=${f.tokens.a}`];
  const operations = [...writes(col, id),
    [collections, "/api/collections", "GET", {}, undefined], [bookmarks, "/api/bookmarks", "GET", {}, undefined],
    [collection, `/api/collections/${col}`, "GET", { id: col }, undefined], [bookmark, `/api/bookmarks/${id}`, "GET", { id }, undefined],
    [me, "/api/auth/me", "GET", {}, undefined], [status, "/api/status", "POST", {}, { conteudo: "Forjado" }]];
  for (const Cookie of cookies) {
    for (const [handler, path, method, params, body] of operations) {
      assert.equal((await f.call(handler, path, { method, params, body, token: null, headers: { Cookie } })).status, 401, `${method} ${path}`);
    }
  }
  assert.equal(f.snapshot(), before);
});

test("QA14: rotas públicas ocultam coleções privadas e respeitam revogação mesmo com sessão do dono", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection("b", true);
  const link = f.seedBookmark("b", col);
  const params = { id: col };
  const path = `/api/public/collections/${col}`;
  assert.equal((await data(await f.call(publicCollection, path, { params, token: null }))).is_public, true);
  const visible = await data(await f.call(publicBookmarks, `${path}/bookmarks`, { params, token: null }));
  assert.deepEqual(visible.map(row => row.id), [link]);
  assert.equal(JSON.stringify(visible).includes(users.b), false);
  await data(await f.call(collection, `/api/collections/${col}`, { method: "PATCH", params, token: f.tokens.b, body: { is_public: false } }));
  const before = f.snapshot();
  for (const token of [null, f.tokens.a, f.tokens.b, f.expired]) {
    for (const [handler, suffix] of [[publicCollection, ""], [publicBookmarks, "/bookmarks"]]) {
      await error(await f.call(handler, `${path}${suffix}`, { params, token }), 404);
    }
  }
  assert.equal(f.snapshot(), before);
});

test("QA15: SQL injection em title é literal em POST/PATCH e todos os filtros rejeitam injeção", async (t) => {
  const f = await fixture(t);
  const own = f.seedCollection("a", true);
  const foreign = f.seedCollection("b");
  f.seedBookmark("b", foreign);
  const title = "x'); DROP TABLE bookmarks; --";
  const saved = await data(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validLink(own, { title }) }), 201);
  assert.equal(saved.title, title);
  const changedTitle = "' OR 1=1; UPDATE collections SET is_public=1; --";
  assert.equal((await data(await f.call(bookmark, `/api/bookmarks/${saved.id}`, { method: "PATCH", params: { id: saved.id }, body: { title: changedTitle } }))).title, changedTitle);
  for (const payload of [title, changedTitle]) {
    assert.ok(f.trace.some(entry => entry.values.includes(payload)), "O valor deve chegar a bind().");
    assert.ok(f.trace.every(entry => !entry.sql.includes(payload)), "O valor não pode compor o SQL.");
  }
  const before = f.snapshot();
  for (const payload of ["' OR 1=1 --", "lendo' UNION SELECT * FROM auth_sessions --", "1; DROP TABLE collections; --"]) {
    for (const field of ["collection_id", "status", "limit"]) {
      await error(await f.call(bookmarks, `/api/bookmarks?${field}=${encodeURIComponent(payload)}`), 400);
    }
    for (const field of ["status", "limit"]) {
      await error(await f.call(publicBookmarks, `/api/public/collections/${own}/bookmarks?${field}=${encodeURIComponent(payload)}`, { params: { id: own }, token: null }), 400);
    }
  }
  for (const query of ["status=lendo&status=concluido", `collection_id=${own}&collection_id=${foreign}`, "status=lendo&OR=1%3D1", "limit=1&limit=100"]) {
    await error(await f.call(bookmarks, `/api/bookmarks?${query}`), 400);
  }
  assert.equal(f.snapshot(), before);
  const rows = await data(await f.call(bookmarks, "/api/bookmarks"));
  assert.deepEqual(rows.map(row => row.id), [saved.id]);
});

const xss = { title: '<img src=x onerror="globalThis.pwned=1">', summary: '</p><svg onload="globalThis.pwned=2"><script>alert(1)</script>' };
test("QA16: XSS em title e summary permanece texto literal nas respostas privadas e públicas", async (t) => {
  const f = await fixture(t);
  const col = f.seedCollection("a", true);
  const saved = await data(await f.call(bookmarks, "/api/bookmarks", { method: "POST", body: validLink(col, xss) }), 201);
  assert.equal(saved.title, xss.title);
  assert.equal(saved.summary, xss.summary);
  const updated = { title: '<script>globalThis.pwned=3</script>', summary: '<a href="javascript:alert(1)">clique</a>' };
  await data(await f.call(bookmark, `/api/bookmarks/${saved.id}`, { method: "PATCH", params: { id: saved.id }, body: updated }));
  for (const [handler, path, params, token] of [
    [bookmarks, "/api/bookmarks", {}, f.tokens.a],
    [publicBookmarks, `/api/public/collections/${col}/bookmarks`, { id: col }, null],
  ]) {
    const response = await f.call(handler, path, { params, token });
    assert.match(response.headers.get("Content-Type"), /^application\/json/);
    const rows = await data(response);
    assert.equal(rows[0].title, updated.title);
    assert.equal(rows[0].summary, updated.summary);
  }
});

// Exercita funções reais do front em VM com um DOM mínimo que falha ao receber HTML.
// Não substitui um teste em navegador; registra os destinos de texto e os nós criados.
function functionSource(source, name) {
  const match = source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`));
  assert.ok(match, `Função ${name} deve existir para a inspeção.`);
  return match[0];
}
function dom() {
  const nodes = [];
  const texts = [];
  const ids = new Map();
  function node(tag) {
    let text = "";
    const value = {
      tag, children: [], dataset: {}, value: "", hidden: false,
      classList: { add() {}, remove() {}, toggle() {} },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, content) { this[name] = String(content); },
      addEventListener() {},
      insertAdjacentHTML() { assert.fail("Inserção HTML não permitida."); },
      set innerHTML(_value) { assert.fail("innerHTML não permitido."); },
      set outerHTML(_value) { assert.fail("outerHTML não permitido."); },
      set textContent(content) { text = String(content); texts.push(text); },
      get textContent() { return text; },
    };
    nodes.push(value);
    return value;
  }
  return { nodes, texts, $: id => { if (!ids.has(id)) ids.set(id, node("div")); return ids.get(id); },
    document: { createElement: node, createDocumentFragment: () => node("fragment") } };
}

for (const [caseId, file, render, helpers] of [
  ["QA17", "public/app.js", "renderBookmarks", ["element", "button", "safeUrl"]],
  ["QA18", "public/colecao.js", "renderLinks", ["element"]],
]) {
  test(`${caseId}: ${file} renderiza XSS com textContent e não cria links javascript`, () => {
    const source = read(file);
    assert.doesNotMatch(source, /\.\s*(?:innerHTML|outerHTML)\s*=|\binsertAdjacentHTML\s*\(|document\.write\s*\(/);
    assert.match(functionSource(source, "element"), /node\.textContent\s*=\s*String\(text\)/);
    const fake = dom();
    const samples = [validLink(randomUUID(), { id: randomUUID(), ...xss, status: "para_ler" }),
      validLink(randomUUID(), { id: randomUUID(), ...xss, url: "javascript:globalThis.pwned=4", status: "lendo" })];
    runInNewContext([...helpers.map(name => functionSource(source, name)), functionSource(source, render),
      render === "renderBookmarks" ? "renderBookmarks();" : "renderLinks(samples);"].join("\n"), {
      ...fake, samples, URL, STATUS: { para_ler: "Para Ler", lendo: "Lendo", concluido: "Concluído" },
      state: { bookmarks: samples, collections: [], collectionsLoaded: true },
    }, { timeout: 1000 });
    assert.ok(fake.texts.includes(xss.title));
    assert.ok(fake.texts.includes(xss.summary));
    assert.equal(fake.nodes.some(item => ["script", "img", "svg"].includes(item.tag)), false);
    const anchors = fake.nodes.filter(item => item.tag === "a");
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].href, "https://example.com/artigo");
    assert.equal(anchors[0].rel, "noopener noreferrer");
  });
}

// Estes testes permanecem vermelhos enquanto as falhas reproduzidas existirem.
for (const [caseId, avatar] of [
  ["QA19", "https://cdn.discordapp.com/avatars/123456789012345678/0123456789abcdef0123456789abcdef.png"],
  ["QA20", "https://cdn.discordapp.com/embed/avatars/0.png"],
]) {
  test(`${caseId}: perfil deve usar a URL completa de avatar entregue por /api/auth/me`, async (t) => {
    const f = await fixture(t);
    f.sqlite.prepare("UPDATE discord_users SET avatar = ? WHERE user_id = ?").run(avatar, users.a);
    const user = await data(await f.call(me, "/api/auth/me"));
    const fake = dom();
    await runInNewContext(`${functionSource(read("public/app.js"), "checkSession")}\ncheckSession();`, {
      ...fake, state: { epoch: 0, checkingSession: false }, ApiError: Error,
      api: async path => { assert.equal(path, "/api/auth/me"); return user; },
      notice() {}, refreshLibrary: async () => {}, friendly: e => String(e), showGuest() {},
    }, { timeout: 1000 });
    assert.equal(fake.$("sessionError").hidden, true, "A verificação de sessão deve concluir sem erro.");
    assert.equal(fake.$("profileUsername").textContent, user.username);
    assert.equal(fake.$("profileUserId").textContent, `user_id: ${user.user_id}`);
    assert.equal(fake.$("profileAvatar").src, user.avatar, "O front deve respeitar o contrato de URL completa.");
  });
}

test("QA21: POST /api/status deve limitar o corpo a 32 KiB antes de ler JSON", async (t) => {
  const f = await fixture(t);
  const base = JSON.stringify({ conteudo: "Diagnóstico" });
  const rawBody = base + " ".repeat(32769 - Buffer.byteLength(base));
  const response = await f.call(status, "/api/status", { method: "POST", rawBody, headers: { "Content-Length": "1" } });
  t.diagnostic(`bytes=${Buffer.byteLength(rawBody)}; HTTP=${response.status}; registros=${f.sqlite.prepare("SELECT count(*) AS n FROM project_records").get().n}`);
  assert.equal(response.status, 413, "Diagnóstico também deve ter limite de entrada.");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM project_records").get().n, 0);
});

test("QA22: POST /api/status deve rejeitar JSON enviado como text/plain", async (t) => {
  const f = await fixture(t);
  const response = await f.call(status, "/api/status", { method: "POST", body: { conteudo: "Mídia incorreta" }, headers: { "Content-Type": "text/plain" } });
  t.diagnostic(`HTTP=${response.status}; registros=${f.sqlite.prepare("SELECT count(*) AS n FROM project_records").get().n}`);
  assert.equal(response.status, 415);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM project_records").get().n, 0);
});

test("QA23: POST /api/status deve rejeitar campos desconhecidos sem gravar", async (t) => {
  const f = await fixture(t);
  const response = await f.call(status, "/api/status", { method: "POST", body: { conteudo: "Com campo extra", unexpected: { admin: true } } });
  t.diagnostic(`HTTP=${response.status}; registros=${f.sqlite.prepare("SELECT count(*) AS n FROM project_records").get().n}`);
  assert.equal(response.status, 400);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM project_records").get().n, 0);
});

function files(dir, excluded = new Set([".git", "node_modules"])) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (excluded.has(entry.name)) return [];
    const path = join(dir, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Revisar link simbólico fora do inventário: ${relative(root, path)}`);
    return entry.isDirectory() ? files(path, excluded) : [path];
  });
}

test("QA24: public contém apenas assets locais, sem frameworks, CDN ou sombras em texto", () => {
  const assets = files(resolve(root, "public"));
  assert.ok(assets.length > 0);
  for (const path of assets) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /\b(?:ReactDOM|createRoot|Vue\.createApp|angular\.module|from\s*["'](?:react|react-dom|vue|next|nuxt|svelte|solid-js|@angular\/core)["'])\b/i, relative(root, path));
    assert.doesNotMatch(source, /(?:unpkg\.com|esm\.sh|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|cdn\.tailwindcss\.com)/i, relative(root, path));
    assert.doesNotMatch(source, /text-shadow\s*:|filter\s*:\s*drop-shadow\s*\(/i, relative(root, path));
    if (path.endsWith(".html")) {
      for (const match of source.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
        assert.doesNotMatch(match[1], /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i, "CSS e scripts devem ser locais.");
        assert.ok(existsSync(resolve(root, "public", match[1].replace(/^\//, ""))), `Asset ausente: ${match[1]}`);
      }
    }
  }
  if (existsSync(resolve(root, "package.json"))) {
    const pkg = JSON.parse(read("package.json"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dependency of ["react", "react-dom", "vue", "next", "nuxt", "@angular/core", "svelte", "solid-js"]) assert.equal(Object.hasOwn(deps, dependency), false);
  }
});

test("QA25: todas as páginas HTML contêm a chave dentro de footer semântico", (t) => {
  const pages = files(resolve(root, "public")).filter(path => path.endsWith(".html"));
  assert.ok(pages.length > 0);
  for (const path of pages) {
    const source = readFileSync(path, "utf8");
    const footers = [...source.matchAll(/<footer\b[^>]*>([\s\S]*?)<\/footer\s*>/gi)];
    assert.ok(footers.length > 0, relative(root, path));
    assert.ok(footers.some(match => match[1].includes(key)), relative(root, path));
    assert.match(source, /<!doctype html>/i);
    assert.match(source, /<html\b[^>]*\blang=["']pt-BR["']/i);
    t.diagnostic(relative(root, path));
  }
});

test("QA26: README contém a chave e URL_CLOUDFLARE HTTPS; licença MIT está presente", () => {
  const readme = read("README.md");
  assert.ok(readme.includes(key));
  const url = readme.match(/URL_CLOUDFLARE[^\n]*?(https:\/\/[^\s`<>]+)/)?.[1];
  assert.ok(url, "URL_CLOUDFLARE deve declarar uma URL HTTPS.");
  assert.match(new URL(url).hostname, /\.(?:pages|workers)\.dev$/);
  const license = read("LICENSE");
  assert.match(license, /MIT License/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test("QA27: três agentes, papel de validação e skills citadas existem no projeto", () => {
  const agents = read("AGENTS.md");
  for (const n of [1, 2, 3]) assert.match(agents, new RegExp(`### Agente ${n}:`));
  assert.match(agents, /Agente 3:.*Teste.*Valida/u);
  for (const skill of ["serverless-d1-discord", "vanilla-dom-ui", "teste-validacao"]) {
    const path = `skills/${skill}/SKILL.md`;
    assert.ok(agents.includes(path));
    assert.ok(existsSync(resolve(root, path)));
    const source = read(path);
    assert.match(source, /^---\r?\nname:/);
    assert.match(source, /Regras Obrigatórias|Checklist de Verificação Obrigatória/);
  }
});

test("QA28: AGENTS documenta harness e modelos sem campos de template pendentes", () => {
  const agents = read("AGENTS.md");
  assert.doesNotMatch(agents, /\*\(Descreva aqui|\*\(Informe os modelos/, "Harness e modelos devem refletir a execução real ou declarar indisponibilidade.");
  assert.match(agents, /Harness Principal:[^\n]+(?:Codex|Antigravity|Claude Code|Cursor|Cline|Copilot|OpenHands)/i);
});

test("QA29: inventário textual não revela segredos literais ou arquivos .dev.vars", (t) => {
  const inventory = files(root);
  const localVars = inventory.filter(path => /^\.dev\.vars(?:\..*)?$/i.test(path.split(/[\\/]/).at(-1)));
  assert.deepEqual(localVars.map(path => relative(root, path)), [], "Revisar .dev.vars local; não publicar valores.");
  const textFiles = inventory.filter(path => /\.(?:[cm]?js|jsonc?|md|sql|html|css|toml|ya?ml|vars|env|txt)$/i.test(path)
    || /(?:^|[\\/])(?:LICENSE|\.gitignore|\.env(?:\.[^\\/]*)?)$/i.test(path));
  const findings = [];
  for (const path of textFiles) {
    const source = readFileSync(path, "utf8");
    const rel = relative(root, path).replaceAll("\\", "/");
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      const literal = line.match(/\b(?:DISCORD_CLIENT_SECRET|CLOUDFLARE_API_TOKEN|access_token|refresh_token|client_secret)\s*[:=]\s*["']([^"']+)["']/i);
      const bare = line.match(/^\s*(?:export\s+)?(?:DISCORD_CLIENT_SECRET|CLOUDFLARE_API_TOKEN|DISCORD_BOT_TOKEN)\s*=\s*([^\s#]+)/i);
      const value = literal?.[1] || bare?.[1]?.replace(/^["']|["']$/g, "");
      const synthetic = rel.startsWith("tests/") && ["test-secret", "discord-test-token", "test"].includes(value);
      const placeholder = value && /^(?:<[^>]+>|\$\{[^}]+\}|(?:your|seu|sua|example|placeholder)[_-].*)$/i.test(value);
      const recognizable = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|xox[baprs]-)[a-zA-Z0-9_-]{20,}|\b(?:mfa\.[\w-]{60,}|[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,})\b/.test(line);
      if ((value && !synthetic && !placeholder) || recognizable) findings.push(`${rel}:${index + 1} (valor omitido)`);
    }
  }
  t.diagnostic(`Arquivos inventariados=${inventory.length}; textos verificados=${textFiles.length}; .dev.vars=${localVars.length}; candidatos=${findings.length}. Binários e histórico Git não são cobertos.`);
  assert.deepEqual(findings, [], "Possíveis credenciais: somente caminhos são exibidos.");
});
