// Suíte de testes de ponta a ponta da API — P26-2C-DA71-C3BA-A1AC-470B
// Node puro (>= 18, fetch global), sem dependências.
//
// Pré-requisitos (ver skills/teste-validacao/SKILL.md):
//   CI=1 npx wrangler d1 migrations apply DB --local < /dev/null
//   npx wrangler pages dev public --port 8788   (em segundo plano)
// Uso:
//   node tests/api.test.mjs            (BASE_URL padrão http://localhost:8788)
//   BASE_URL=http://127.0.0.1:8788 node tests/api.test.mjs
//
// Fixtures: usuários e sessões são criados diretamente no D1 LOCAL via
// `wrangler d1 execute DB --local --command ...` (CI=1). O token vai no
// cookie `sid`; no banco fica só o SHA-256 hex em sessions.token_hash.
// No fim, as fixtures são apagadas e os estoques voltam aos valores do seed
// (lidos de migrations/0002_seed_products.sql).

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREFIX = "test-a4-";

// ---------------------------------------------------------------- D1 local
const WRANGLER_JS = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

// Executa SQL no D1 local e devolve um array de resultados (um por statement).
function d1(sql) {
  const args = ["d1", "execute", "DB", "--local", "--json", "--command", sql];
  const opts = { cwd: ROOT, encoding: "utf8", env: { ...process.env, CI: "1" }, maxBuffer: 32 * 1024 * 1024 };
  // Mesmo binário que `npx wrangler`; chamado via node para evitar problemas
  // de aspas do shell (cmd.exe) com o SQL.
  const r = existsSync(WRANGLER_JS)
    ? spawnSync(process.execPath, [WRANGLER_JS, ...args], opts)
    : spawnSync("npx", ["wrangler", ...args], { ...opts, shell: true });
  if (r.status !== 0) {
    throw new Error(`wrangler d1 execute falhou (${r.status}):\n${r.stderr}\n${r.stdout}`);
  }
  const out = r.stdout;
  const start = out.indexOf("[");
  if (start < 0) throw new Error("saída sem JSON do wrangler: " + out);
  return JSON.parse(out.slice(start));
}
const rows = (res, i = 0) => res[i]?.results || [];
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

// ---------------------------------------------------------------- HTTP
async function api(path, { method = "GET", cookie, body, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = `sid=${cookie}`;
  let payload;
  if (body !== undefined) {
    payload = raw ? body : JSON.stringify(body);
    if (!h["Content-Type"]) h["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, headers: res.headers, json, text };
}
const checkout = (cookie, items, extra = {}, headers = {}) =>
  api("/api/checkout", { method: "POST", cookie, body: { items, ...extra }, headers });

// ---------------------------------------------------------------- mini runner
const results = [];
let current = "";
async function test(name, fn) {
  current = name;
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASSOU  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: String(err?.stack || err) });
    console.log(`FALHOU  ${name}\n        ${String(err?.message || err).split("\n").join("\n        ")}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "asserção falhou"); }
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg || "valores diferentes"}: obtido ${A}, esperado ${B}`);
}
function isJsonResponse(r) {
  const ct = r.headers.get("content-type") || "";
  assert(ct.includes("application/json"), `Content-Type não é JSON: "${ct}" (corpo: ${r.text.slice(0, 120)})`);
}
function isError(r, status, code) {
  eq(r.status, status, `status HTTP (corpo ${r.text.slice(0, 200)})`);
  isJsonResponse(r);
  assert(r.json && r.json.ok === false, "esperado ok:false");
  eq(r.json.error, code, "código de erro");
  assert(typeof r.json.message === "string" && r.json.message.length > 0, "message ausente");
}

// ---------------------------------------------------------------- fixtures
const now = () => Math.floor(Date.now() / 1000);
const token = () => randomBytes(32).toString("hex");
const sha = (t) => createHash("sha256").update(t).digest("hex");

const U = {
  a: { id: PREFIX + "a", name: "Teste A", balance: 5000 },     // fluxo feliz / anti-manipulação
  b: { id: PREFIX + "b", name: "Teste B", balance: 5000 },     // "outro usuário"
  c: { id: PREFIX + "c", name: "Teste C", balance: 1000 },     // concorrência de saldo
  d: { id: PREFIX + "d", name: "Teste D", balance: 100 },      // saldo insuficiente
  e: { id: PREFIX + "e", name: "Teste E", balance: 100000 },   // concorrência de estoque
  f: { id: PREFIX + "f", name: "Teste F", balance: 5000 },     // logout
  g: { id: PREFIX + "g", name: "Teste G", balance: 5000 },     // frontend / reserva
};
const S = {};       // userKey -> token válido
let EXPIRED = "";   // token de sessão expirada (usuário A)

function seedStocks() {
  const sql = readFileSync(join(ROOT, "migrations", "0002_seed_products.sql"), "utf8");
  const out = [];
  // ('SKU', 'nome', 'desc', 'categoria', preço, estoque, 'ícone')
  const re = /\(\s*'([A-Z]{3}-\d{3})'\s*,(?:\s*'(?:[^']|'')*'\s*,){3}\s*(\d+)\s*,\s*(\d+)\s*,/g;
  let m;
  while ((m = re.exec(sql))) out.push({ sku: m[1], price: Number(m[2]), stock: Number(m[3]) });
  return out;
}
const SEED = seedStocks();

function cleanupSql() {
  const like = q(PREFIX + "%");
  return [
    `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id LIKE ${like})`,
    `DELETE FROM orders WHERE user_id LIKE ${like}`,
    `DELETE FROM sessions WHERE user_id LIKE ${like}`,
    `DELETE FROM users WHERE user_id LIKE ${like}`,
    ...SEED.map((p) => `UPDATE products SET stock = ${p.stock} WHERE sku = ${q(p.sku)}`),
  ].join("; ");
}

function createFixtures() {
  const stmts = [];
  for (const [k, u] of Object.entries(U)) {
    S[k] = token();
    stmts.push(`INSERT INTO users (user_id, username, avatar, balance) VALUES (${q(u.id)}, ${q(u.name)}, NULL, ${u.balance})`);
    stmts.push(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${q(sha(S[k]))}, ${q(u.id)}, ${now() + 3600})`);
  }
  EXPIRED = token();
  stmts.push(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${q(sha(EXPIRED))}, ${q(U.a.id)}, ${now() - 60})`);
  d1(stmts.join("; "));
}

// Retrato do banco: saldos dos usuários de teste, estoques e contagem de pedidos/itens.
function snapshot() {
  const res = d1([
    `SELECT user_id, balance FROM users WHERE user_id LIKE ${q(PREFIX + "%")} ORDER BY user_id`,
    `SELECT id, stock FROM products ORDER BY id`,
    `SELECT COUNT(*) AS n FROM orders`,
    `SELECT COUNT(*) AS n FROM order_items`,
  ].join("; "));
  return {
    balances: Object.fromEntries(rows(res, 0).map((r) => [r.user_id, r.balance])),
    stocks: Object.fromEntries(rows(res, 1).map((r) => [r.id, r.stock])),
    orders: rows(res, 2)[0].n,
    items: rows(res, 3)[0].n,
  };
}

// ---------------------------------------------------------------- suíte
let P = {};        // sku -> produto (da API)
let byId = {};     // id -> produto

async function main() {
  console.log(`BASE_URL = ${BASE}`);

  // Portão de saúde: sem isso, o relatório é "ambiente quebrado".
  let st;
  try { st = await api("/api/status"); } catch (e) {
    console.log(`AMBIENTE QUEBRADO: servidor inacessível em ${BASE} (${e.message})`);
    process.exit(2);
  }
  if (st.status !== 200 || !st.json?.d1Connected || !(st.json?.products > 0)) {
    console.log(`AMBIENTE QUEBRADO: /api/status = ${st.status} ${st.text}`);
    process.exit(2);
  }
  console.log(`Portão de saúde OK: ${st.text}`);

  // Limpa restos de execuções anteriores e cria fixtures.
  d1(cleanupSql());
  createFixtures();

  try {
    await runAll(st);
  } finally {
    try {
      d1(cleanupSql());
      const left = d1(`SELECT COUNT(*) AS n FROM users WHERE user_id LIKE ${q(PREFIX + "%")}`);
      console.log(`Limpeza: fixtures removidas (restantes=${rows(left)[0].n}); estoques restaurados ao seed.`);
    } catch (e) {
      console.log("ATENÇÃO: limpeza falhou: " + e.message);
    }
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\nResumo: ${pass} passaram, ${fail} falharam, ${results.length} casos.`);
  process.exit(fail ? 1 : 0);
}

async function runAll(st) {
  // ---------------- status
  await test("GET /api/status: contrato (chave, projectId 35, d1Connected, products)", async () => {
    eq(st.status, 200);
    isJsonResponse(st);
    const s = st.json;
    eq(s.ok, true);
    eq(s.chave, "P26-2C-DA71-C3BA-A1AC-470B", "chave");
    eq(s.projectId, 35, "projectId");
    eq(s.d1Connected, true, "d1Connected");
    eq(s.products, SEED.length, "products");
    eq(typeof s.discordOAuthConfigured, "boolean", "discordOAuthConfigured");
    assert(!Number.isNaN(Date.parse(s.serverTimestamp)), "serverTimestamp inválido");
  });

  // ---------------- catálogo
  const all = await api("/api/products");
  P = Object.fromEntries((all.json?.products || []).map((p) => [p.sku, p]));
  byId = Object.fromEntries((all.json?.products || []).map((p) => [p.id, p]));

  await test("GET /api/products: catálogo completo, campos, categories e priceRange", async () => {
    eq(all.status, 200);
    isJsonResponse(all);
    eq(all.json.products.length, SEED.length, "quantidade de produtos");
    for (const p of all.json.products) {
      for (const k of ["id", "sku", "name", "description", "category", "price", "stock", "icon"]) {
        assert(k in p, `campo ${k} ausente em ${p.sku}`);
      }
      const s = SEED.find((x) => x.sku === p.sku);
      eq([p.price, p.stock], [s.price, s.stock], `preço/estoque de ${p.sku} vs seed`);
    }
    eq(all.json.categories, ["Colecionáveis", "Itens Digitais", "Periféricos", "Software"], "categories");
    eq(all.json.priceRange, { min: 50, max: 2900 }, "priceRange");
  });

  await test("GET /api/products: ordenação padrão por nome", async () => {
    const names = all.json.products.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    eq(names, sorted, "ordem por nome");
  });

  await test("GET /api/products?sort=price_asc e price_desc", async () => {
    const a = await api("/api/products?sort=price_asc");
    const d = await api("/api/products?sort=price_desc");
    eq(a.status, 200); eq(d.status, 200);
    const pa = a.json.products.map((p) => p.price);
    const pd = d.json.products.map((p) => p.price);
    eq(pa, [...pa].sort((x, y) => x - y), "price_asc");
    eq(pd, [...pd].sort((x, y) => y - x), "price_desc");
    eq(pa.length, SEED.length);
  });

  await test("GET /api/products?category=Software (e categories/priceRange do catálogo inteiro)", async () => {
    const r = await api("/api/products?category=" + encodeURIComponent("Software"));
    eq(r.status, 200);
    assert(r.json.products.length === 3, "esperados 3 produtos Software, veio " + r.json.products.length);
    assert(r.json.products.every((p) => p.category === "Software"), "categoria errada no resultado");
    eq(r.json.categories.length, 4, "categories deve refletir o catálogo inteiro");
    eq(r.json.priceRange, { min: 50, max: 2900 }, "priceRange deve refletir o catálogo inteiro");
  });

  await test("GET /api/products?q=teclado (nome) e q=fictícios (descrição)", async () => {
    const r = await api("/api/products?q=" + encodeURIComponent("teclado"));
    eq(r.status, 200);
    assert(r.json.products.some((p) => p.sku === "PER-001"), "PER-001 deveria aparecer");
    assert(r.json.products.every((p) => /teclado/i.test(p.name + " " + p.description)), "resultado sem o termo");
    const r2 = await api("/api/products?q=" + encodeURIComponent("100 níveis"));
    eq(r2.json.products.map((p) => p.sku), ["DIG-003"], "busca na descrição");
    const r3 = await api("/api/products?q=" + encodeURIComponent("%"));
    eq(r3.json.products.length, 0, "'%' deve ser literal, não curinga");
  });

  await test("GET /api/products?min=100&max=500 (limites inclusivos)", async () => {
    const r = await api("/api/products?min=100&max=500");
    eq(r.status, 200);
    assert(r.json.products.length > 0, "vazio");
    assert(r.json.products.every((p) => p.price >= 100 && p.price <= 500), "fora da faixa");
    const expected = SEED.filter((s) => s.price >= 100 && s.price <= 500).length;
    eq(r.json.products.length, expected, "quantidade na faixa");
    const ex = await api("/api/products?min=890&max=890");
    eq(ex.json.products.map((p) => p.sku), ["PER-001"], "min=max=890");
  });

  for (const qs of ["min=abc", "max=-1", "min=1.5", "min=500&max=100", "sort=foo"]) {
    await test(`GET /api/products?${qs} → 400 invalid_filter`, async () => {
      isError(await api("/api/products?" + qs), 400, "invalid_filter");
    });
  }

  // ---------------- autenticação
  for (const [method, path] of [["GET", "/api/me"], ["GET", "/api/orders"], ["GET", "/api/orders/abc"], ["POST", "/api/checkout"]]) {
    await test(`${method} ${path} sem cookie → 401 unauthorized`, async () => {
      const r = await api(path, { method, body: method === "POST" ? { items: [{ productId: 1, quantity: 1 }] } : undefined });
      isError(r, 401, "unauthorized");
    });
  }

  await test("Cookie inválido (token inexistente e token malformado) → 401", async () => {
    isError(await api("/api/me", { cookie: token() }), 401, "unauthorized");
    isError(await api("/api/me", { cookie: "nao-e-hex" }), 401, "unauthorized");
    isError(await api("/api/me", { cookie: sha(S.a) }), 401, "unauthorized"); // o hash não serve como token
  });

  await test("Sessão expirada → 401 em /api/me, /api/orders e /api/checkout (nada debitado)", async () => {
    isError(await api("/api/me", { cookie: EXPIRED }), 401, "unauthorized");
    isError(await api("/api/orders", { cookie: EXPIRED }), 401, "unauthorized");
    const before = snapshot();
    isError(await checkout(EXPIRED, [{ productId: P["COL-002"].id, quantity: 1 }]), 401, "unauthorized");
    eq(snapshot(), before, "banco mudou após checkout com sessão expirada");
  });

  await test("GET /api/me com sessão válida → usuário e saldo do D1", async () => {
    const r = await api("/api/me", { cookie: S.a });
    eq(r.status, 200);
    isJsonResponse(r);
    eq(r.json.ok, true);
    eq(r.json.user.user_id, U.a.id);
    eq(r.json.user.username, U.a.name);
    eq(r.json.user.balance, 5000);
    assert("avatar" in r.json.user && "created_at" in r.json.user, "avatar/created_at ausentes");
  });

  // ---------------- checkout feliz
  let firstOrder;
  await test("Checkout feliz: saldo = Σ preço_D1 × qtd, estoque baixado, recibo 201 no formato do contrato", async () => {
    const p1 = P["PER-001"], p2 = P["DIG-002"];
    const before = snapshot();
    const r = await checkout(S.a, [{ productId: p1.id, quantity: 2 }, { productId: p2.id, quantity: 1 }], {},
      { Origin: BASE }); // Origin da mesma origem deve ser aceito
    eq(r.status, 201, "status (corpo " + r.text.slice(0, 200) + ")");
    isJsonResponse(r);
    const o = r.json.order;
    const total = p1.price * 2 + p2.price;
    eq(o.total, total, "total");
    eq(o.item_count, 3, "item_count (soma das quantidades)");
    eq(o.balance_before, 5000, "balance_before");
    eq(o.balance_after, 5000 - total, "balance_after");
    eq(r.json.balance, 5000 - total, "balance");
    assert(/^[0-9a-f-]{36}$/.test(o.id), "id não é UUID: " + o.id);
    assert(o.created_at, "created_at ausente");
    eq(o.items.length, 2, "itens");
    const it1 = o.items.find((i) => i.product_id === p1.id);
    eq(it1, { product_id: p1.id, product_name: p1.name, unit_price: p1.price, quantity: 2, subtotal: p1.price * 2 }, "item 1");
    const after = snapshot();
    eq(after.balances[U.a.id], 5000 - total, "saldo no D1");
    eq(after.stocks[p1.id], before.stocks[p1.id] - 2, "estoque PER-001");
    eq(after.stocks[p2.id], before.stocks[p2.id] - 1, "estoque DIG-002");
    eq(after.orders, before.orders + 1, "orders +1");
    eq(after.items, before.items + 2, "order_items +2");
    const me = await api("/api/me", { cookie: S.a });
    eq(me.json.user.balance, 5000 - total, "/api/me após compra");
    firstOrder = o;
  });

  await test("GET /api/orders/:id devolve o recibo idêntico; GET /api/orders o lista", async () => {
    assert(firstOrder, "sem pedido do caso anterior");
    const r = await api("/api/orders/" + firstOrder.id, { cookie: S.a });
    eq(r.status, 200);
    eq(r.json.ok, true);
    eq(r.json.order, firstOrder, "recibo");
    const l = await api("/api/orders", { cookie: S.a });
    eq(l.status, 200);
    assert(l.json.orders.some((o) => o.id === firstOrder.id), "pedido ausente do histórico");
    eq(l.json.orders.find((o) => o.id === firstOrder.id), firstOrder, "pedido no histórico");
  });

  await test("IDs repetidos no carrinho são somados num item só", async () => {
    const p = P["DIG-004"];
    const r = await checkout(S.a, [{ productId: p.id, quantity: 1 }, { productId: p.id, quantity: 2 }]);
    eq(r.status, 201, "status " + r.text.slice(0, 200));
    eq(r.json.order.items.length, 1, "um item");
    eq(r.json.order.items[0].quantity, 3, "quantidade somada");
    eq(r.json.order.total, p.price * 3, "total");
  });

  await test("Histórico: mais recentes primeiro, todos com items", async () => {
    const l = await api("/api/orders", { cookie: S.a });
    const o = l.json.orders;
    assert(o.length >= 2, "esperados >= 2 pedidos");
    eq(o[o.length - 1].id, firstOrder.id, "o primeiro pedido deve ser o último da lista");
    assert(o.every((x) => Array.isArray(x.items) && x.items.length > 0), "pedido sem items");
    assert(o.length <= 50, "mais de 50");
  });

  // ---------------- anti-manipulação
  await test("Anti-manipulação: price/total/user_id/unit_price no corpo são ignorados", async () => {
    const p = P["SOF-001"];
    const before = snapshot();
    const r = await checkout(S.a,
      [{ productId: p.id, quantity: 1, price: 1, unit_price: 1, subtotal: 1, total: 1 }],
      { total: 1, price: 1, user_id: U.b.id, userId: U.b.id, balance: 999999 });
    eq(r.status, 201, "status " + r.text.slice(0, 200));
    eq(r.json.order.total, p.price, "total deve vir do D1");
    eq(r.json.order.items[0].unit_price, p.price, "unit_price deve vir do D1");
    const after = snapshot();
    eq(after.balances[U.a.id], before.balances[U.a.id] - p.price, "debitado do usuário da sessão");
    eq(after.balances[U.b.id], before.balances[U.b.id], "outro usuário (user_id do corpo) intocado");
    const ob = await api("/api/orders", { cookie: S.b });
    eq(ob.json.orders.length, 0, "pedido não pode aparecer para o user_id do corpo");
  });

  const badBodies = [
    ["quantidade 0", { items: [{ productId: 1, quantity: 0 }] }],
    ["quantidade negativa", { items: [{ productId: 1, quantity: -1 }] }],
    ["quantidade fracionária", { items: [{ productId: 1, quantity: 1.5 }] }],
    ["quantidade string", { items: [{ productId: 1, quantity: "2" }] }],
    ["quantidade > 99", { items: [{ productId: 1, quantity: 100 }] }],
    ["quantidade ausente", { items: [{ productId: 1 }] }],
    ["productId 0", { items: [{ productId: 0, quantity: 1 }] }],
    ["productId string", { items: [{ productId: "1", quantity: 1 }] }],
    ["productId fracionário", { items: [{ productId: 1.5, quantity: 1 }] }],
    ["items vazio", { items: [] }],
    ["items ausente", {}],
    ["items não-array", { items: { productId: 1, quantity: 1 } }],
    ["51 entradas", { items: Array.from({ length: 51 }, () => ({ productId: 1, quantity: 1 })) }],
    ["item null", { items: [null] }],
  ];
  await test("Anti-manipulação: corpos inválidos → 400 invalid_items e nada muda no banco", async () => {
    const before = snapshot();
    for (const [label, body] of badBodies) {
      const r = await api("/api/checkout", { method: "POST", cookie: S.a, body });
      try { isError(r, 400, "invalid_items"); } catch (e) { throw new Error(`[${label}] ${e.message}`); }
    }
    eq(snapshot(), before, "banco mudou após corpos inválidos");
  });

  await test("Corpo não-JSON → 400 invalid_json", async () => {
    isError(await api("/api/checkout", { method: "POST", cookie: S.a, body: "{nao json", raw: true }), 400, "invalid_json");
  });

  await test("Produto inexistente → 404 product_not_found com productId; nada muda", async () => {
    const before = snapshot();
    const r = await checkout(S.a, [{ productId: P["DIG-005"].id, quantity: 1 }, { productId: 999999, quantity: 1 }]);
    isError(r, 404, "product_not_found");
    eq(r.json.productId, 999999, "productId");
    eq(snapshot(), before, "banco mudou");
  });

  await test("Estoque insuficiente → 409 insufficient_stock com details; NADA muda (saldo, estoque, pedidos)", async () => {
    const zero = P["COL-003"], rare = P["COL-001"], ok = P["COL-002"];
    const before = snapshot();
    const r = await checkout(S.a, [
      { productId: ok.id, quantity: 1 },                       // item válido no mesmo carrinho
      { productId: rare.id, quantity: rare.stock + 1 },
      { productId: zero.id, quantity: 1 },
    ]);
    isError(r, 409, "insufficient_stock");
    const det = r.json.details;
    assert(Array.isArray(det) && det.length === 2, "details deve listar os 2 itens faltantes: " + JSON.stringify(det));
    eq(det.find((d) => d.productId === rare.id), { productId: rare.id, name: rare.name, requested: rare.stock + 1, available: rare.stock }, "detalhe COL-001");
    eq(det.find((d) => d.productId === zero.id), { productId: zero.id, name: zero.name, requested: 1, available: 0 }, "detalhe COL-003");
    eq(snapshot(), before, "banco mudou após 409 de estoque");
  });

  await test("Saldo insuficiente → 409 insufficient_balance com total e balance; NADA muda", async () => {
    const p = P["PER-004"];
    const before = snapshot();
    const r = await checkout(S.d, [{ productId: p.id, quantity: 1 }]);
    isError(r, 409, "insufficient_balance");
    eq(r.json.total, p.price, "total");
    eq(r.json.balance, 100, "balance");
    eq(snapshot(), before, "banco mudou após 409 de saldo");
  });

  await test("Saldo exato: compra que zera o saldo é aceita (balance_after 0)", async () => {
    // D tem 100: 2 × Troféu (50) = 100
    const p = P["COL-002"];
    const r = await checkout(S.d, [{ productId: p.id, quantity: 2 }]);
    eq(r.status, 201, "status " + r.text.slice(0, 200));
    eq(r.json.balance, 0, "saldo final");
    isError(await checkout(S.d, [{ productId: p.id, quantity: 1 }]), 409, "insufficient_balance");
  });

  await test("Origin estranho → 403 forbidden_origin; nada muda", async () => {
    const before = snapshot();
    const r = await checkout(S.a, [{ productId: P["COL-002"].id, quantity: 1 }], {}, { Origin: "https://evil.example" });
    isError(r, 403, "forbidden_origin");
    eq(snapshot(), before, "banco mudou após Origin estranho");
  });

  // ---------------- concorrência
  await test("Concorrência de saldo: 8 checkouts simultâneos (8×450 > 1000) — saldo nunca negativo, Σ totais = inicial − final, estoque conservado", async () => {
    const p = P["DIG-003"]; // 450
    const before = snapshot();
    const N = 8;
    const rs = await Promise.all(Array.from({ length: N }, () => checkout(S.c, [{ productId: p.id, quantity: 1 }])));
    const okR = rs.filter((r) => r.status === 201);
    const other = rs.filter((r) => r.status !== 201);
    for (const r of other) {
      assert(r.status === 409 && ["insufficient_balance", "conflict_retry"].includes(r.json?.error),
        `resposta inesperada: ${r.status} ${r.text.slice(0, 160)}`);
    }
    const after = snapshot();
    const final = after.balances[U.c.id];
    assert(final >= 0, "saldo negativo: " + final);
    const sum = okR.reduce((s, r) => s + r.json.order.total, 0);
    eq(sum, 1000 - final, "Σ totais = inicial − final");
    assert(okR.length <= 2, "mais compras aceitas do que o saldo permite: " + okR.length);
    assert(okR.length >= 1, "nenhuma compra aceita");
    eq(before.stocks[p.id] - after.stocks[p.id], okR.length, "estoque baixado = unidades vendidas");
    eq(after.orders - before.orders, okR.length, "pedidos gravados = respostas 201");
    const ord = d1(`SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS n FROM orders WHERE user_id = ${q(U.c.id)}`);
    eq(rows(ord)[0].s, sum, "Σ orders.total no D1");
    const bad = d1(`SELECT COUNT(*) AS n FROM orders WHERE user_id = ${q(U.c.id)} AND balance_after <> balance_before - total`);
    eq(rows(bad)[0].n, 0, "balance_before/after incoerentes");
    console.log(`        (201: ${okR.length}, 409: ${other.map((r) => r.json?.error).join(",") || "-"}; saldo final ${final})`);
  });

  await test("Concorrência de estoque: 6 checkouts simultâneos de COL-001 (estoque 3) — estoque nunca negativo e conservado", async () => {
    const p = P["COL-001"];
    const before = snapshot();
    const stock0 = before.stocks[p.id];
    const rs = await Promise.all(Array.from({ length: 6 }, () => checkout(S.e, [{ productId: p.id, quantity: 1 }])));
    const okR = rs.filter((r) => r.status === 201);
    for (const r of rs.filter((r) => r.status !== 201)) {
      assert(r.status === 409 && ["insufficient_stock", "conflict_retry"].includes(r.json?.error),
        `resposta inesperada: ${r.status} ${r.text.slice(0, 160)}`);
    }
    const after = snapshot();
    assert(after.stocks[p.id] >= 0, "estoque negativo");
    eq(stock0 - after.stocks[p.id], okR.length, "estoque vendido = respostas 201");
    assert(okR.length <= stock0, "vendeu mais que o estoque");
    eq(before.balances[U.e.id] - after.balances[U.e.id], okR.length * p.price, "saldo debitado = unidades × preço");
    console.log(`        (201: ${okR.length} de 6; estoque ${stock0} → ${after.stocks[p.id]})`);
  });

  await test("Concorrência mista: 2 usuários × 4 carrinhos simultâneos — estoque + vendido = inicial para cada produto", async () => {
    const items = [{ productId: P["PER-003"].id, quantity: 3 }, { productId: P["SOF-003"].id, quantity: 2 }];
    const before = snapshot();
    const rs = await Promise.all([
      ...Array.from({ length: 4 }, () => checkout(S.e, items)),
      ...Array.from({ length: 4 }, () => checkout(S.b, items)),
    ]);
    const okR = rs.filter((r) => r.status === 201);
    for (const r of rs.filter((r) => r.status !== 201)) {
      assert(r.status === 409, `resposta inesperada: ${r.status} ${r.text.slice(0, 160)}`);
    }
    const after = snapshot();
    for (const it of items) {
      const sold = okR.reduce((s, r) => s + (r.json.order.items.find((x) => x.product_id === it.productId)?.quantity || 0), 0);
      eq(before.stocks[it.productId] - after.stocks[it.productId], sold, `conservação de estoque do produto ${it.productId}`);
      assert(after.stocks[it.productId] >= 0, "estoque negativo");
    }
    for (const u of [U.e, U.b]) assert(after.balances[u.id] >= 0, "saldo negativo");
    const debited = (before.balances[U.e.id] - after.balances[U.e.id]) + (before.balances[U.b.id] - after.balances[U.b.id]);
    eq(debited, okR.reduce((s, r) => s + r.json.order.total, 0), "Σ débitos = Σ totais");
    console.log(`        (201: ${okR.length} de 8; PER-003 estoque ${before.stocks[items[0].productId]} → ${after.stocks[items[0].productId]})`);
  });

  // ---------------- isolamento entre usuários
  await test("Pedido de outro usuário → 404 order_not_found; id inexistente → 404", async () => {
    assert(firstOrder, "sem pedido de A");
    isError(await api("/api/orders/" + firstOrder.id, { cookie: S.b }), 404, "order_not_found");
    isError(await api("/api/orders/00000000-0000-0000-0000-000000000000", { cookie: S.a }), 404, "order_not_found");
    isError(await api("/api/orders/" + "x".repeat(200), { cookie: S.a }), 404, "order_not_found");
    const lb = await api("/api/orders", { cookie: S.b });
    assert(!lb.json.orders.some((o) => o.id === firstOrder.id), "pedido de A no histórico de B");
  });

  // ---------------- comportamentos do framework
  for (const [method, path] of [["PUT", "/api/checkout"], ["GET", "/api/checkout"], ["DELETE", "/api/me"], ["POST", "/api/products"], ["GET", "/api/auth/logout"]]) {
    await test(`${method} ${path} → 405 (JSON method_not_allowed)`, async () => {
      isError(await api(path, { method, cookie: S.a }), 405, "method_not_allowed");
    });
  }

  for (const path of ["/api/nada", "/api/orders/abc/def", "/api/products/1"]) {
    await test(`GET ${path} → 404 JSON not_found`, async () => {
      isError(await api(path), 404, "not_found");
    });
  }

  await test("GET / serve o frontend (HTML com a chave)", async () => {
    const r = await api("/");
    eq(r.status, 200);
    assert((r.headers.get("content-type") || "").includes("text/html"), "não é HTML");
    assert(r.text.includes("P26-2C-DA71-C3BA-A1AC-470B"), "chave ausente do HTML");
  });

  // ---------------- OAuth (sem credenciais locais)
  await test("GET /api/auth/discord → 503 oauth_not_configured (sem credenciais) ou 302 para o Discord", async () => {
    const r = await api("/api/auth/discord");
    if (st.json.discordOAuthConfigured) {
      eq(r.status, 302);
      const loc = new URL(r.headers.get("location"));
      eq(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
      eq(loc.searchParams.get("scope"), "identify");
      assert(/oauth_state=/.test(r.headers.get("set-cookie") || ""), "cookie oauth_state ausente");
    } else {
      isError(r, 503, "oauth_not_configured");
    }
  });

  await test("GET /api/auth/discord/callback com state ausente/errado → 302 /?auth_error=invalid_state", async () => {
    const r = await api("/api/auth/discord/callback?code=x&state=abc");
    eq(r.status, 302);
    assert(/\/\?auth_error=invalid_state$/.test(r.headers.get("location") || ""), "Location: " + r.headers.get("location"));
    const r2 = await api("/api/auth/discord/callback?code=x&state=abc", { headers: { Cookie: "oauth_state=outro" } });
    eq(r2.status, 302);
    assert(/auth_error=invalid_state/.test(r2.headers.get("location") || ""), "state divergente aceito");
  });

  // ---------------- logout
  await test("POST /api/auth/logout com Origin estranho → 403 (sessão continua válida)", async () => {
    isError(await api("/api/auth/logout", { method: "POST", cookie: S.f, headers: { Origin: "https://evil.example" } }), 403, "forbidden_origin");
    eq((await api("/api/me", { cookie: S.f })).status, 200, "sessão deveria continuar válida");
  });

  await test("POST /api/auth/logout: 200, cookie expirado, sessão apagada no D1, depois 401", async () => {
    const r = await api("/api/auth/logout", { method: "POST", cookie: S.f });
    eq(r.status, 200, "status " + r.text);
    eq(r.json, { ok: true });
    const sc = r.headers.get("set-cookie") || "";
    assert(/sid=;/.test(sc) && /Max-Age=0/i.test(sc), "Set-Cookie não expira sid: " + sc);
    const left = d1(`SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ${q(sha(S.f))}`);
    eq(rows(left)[0].n, 0, "sessão ainda existe no D1");
    isError(await api("/api/me", { cookie: S.f }), 401, "unauthorized");
    isError(await api("/api/auth/logout", { method: "POST", cookie: S.f }), 401, "unauthorized");
  });

  // ---------------- invariantes finais
  await test("Invariantes no D1: nenhum saldo/estoque negativo; pedidos coerentes com itens", async () => {
    const res = d1([
      `SELECT COUNT(*) AS n FROM users WHERE balance < 0`,
      `SELECT COUNT(*) AS n FROM products WHERE stock < 0`,
      `SELECT COUNT(*) AS n FROM orders o WHERE o.user_id LIKE ${q(PREFIX + "%")} AND (o.total <> (SELECT SUM(subtotal) FROM order_items i WHERE i.order_id = o.id) OR o.item_count <> (SELECT SUM(quantity) FROM order_items i WHERE i.order_id = o.id))`,
      `SELECT COUNT(*) AS n FROM order_items WHERE subtotal <> unit_price * quantity`,
    ].join("; "));
    eq(rows(res, 0)[0].n, 0, "saldos negativos");
    eq(rows(res, 1)[0].n, 0, "estoques negativos");
    eq(rows(res, 2)[0].n, 0, "pedidos com total/item_count incoerentes");
    eq(rows(res, 3)[0].n, 0, "itens com subtotal incoerente");
  });
}

main().catch((e) => {
  console.error("Erro fatal na suíte:", e);
  try { d1(cleanupSql()); } catch {}
  process.exit(3);
});
