import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Teste do backend (Agente 3). Requer Node 22.5+ (node:sqlite). Uso: node tests/backend.test.mjs
const P = fileURLToPath(new URL('../', import.meta.url));
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(P + 'migrations/0001_init.sql', 'utf8'));
const mk = (sql, args = []) => ({
  bind: (...a) => mk(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
});
const DB = { prepare: (s) => mk(s), batch: async (st) => Promise.all(st.map((s) => s.all())) };
const env = { DB, DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec' };
const imp = (p) => import(pathToFileURL(P + p).href);
const lib = await imp('functions/_lib.js');
const start = await imp('functions/api/auth/discord.js');
const cb = await imp('functions/api/auth/discord/callback.js');
const me = await imp('functions/api/me.js');
const logout = await imp('functions/api/auth/logout.js');
const tx = await imp('functions/api/transactions/index.js');
const txid = await imp('functions/api/transactions/[id].js');
const O = 'https://x.pages.dev';
let discordUser = { id: '123456789012345678', username: 'gabriel', global_name: 'Gabriel', avatar: null };
globalThis.fetch = async (u) => String(u).includes('oauth2/token')
  ? new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
  : new Response(JSON.stringify(discordUser), { status: 200 });

async function login(user) {
  discordUser = user;
  const r1 = await start.onRequestGet({ request: new Request(O + '/api/auth/discord'), env });
  assert.equal(r1.status, 302);
  assert.ok(r1.headers.get('Location').includes('redirect_uri=https%3A%2F%2Fx.pages.dev%2Fapi%2Fauth%2Fdiscord%2Fcallback'));
  const state = new URL(r1.headers.get('Location')).searchParams.get('state');
  // state errado
  const bad = await cb.onRequestGet({ request: new Request(`${O}/cb?code=c&state=zzz`, { headers: { Cookie: `oauth_state=${state}` } }), env });
  assert.ok(bad.headers.get('Location').includes('erro=estado'));
  const r2 = await cb.onRequestGet({ request: new Request(`${O}/cb?code=c&state=${state}`, { headers: { Cookie: `oauth_state=${state}` } }), env });
  assert.equal(r2.headers.get('Location'), '/');
  const sid = r2.headers.getSetCookie().find((c) => c.startsWith('sid=')).split(';')[0];
  assert.ok(r2.headers.getSetCookie()[0].includes('HttpOnly') && r2.headers.getSetCookie()[0].includes('Secure'));
  return sid;
}
const req = (path, sid, method = 'GET', body, extra = {}) =>
  new Request(O + path, { method, headers: { ...(sid ? { Cookie: sid } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });

// sem login
assert.equal((await me.onRequestGet({ request: req('/api/me'), env })).status, 401);
assert.equal((await tx.onRequestGet({ request: req('/api/transactions'), env })).status, 401);

const A = await login({ id: '123456789012345678', username: 'gabriel', global_name: 'Gabriel', avatar: null });
const B = await login({ id: '999', username: 'outro', avatar: 'abc' });
let r = await me.onRequestGet({ request: req('/api/me', A), env });
let j = await r.json();
assert.equal(j.user.username, 'Gabriel'); assert.match(j.user.avatar_url, /embed\/avatars\/\d\.png/);
j = await (await me.onRequestGet({ request: req('/api/me', B), env })).json();
assert.match(j.user.avatar_url, /avatars\/999\/abc\.png/);

const good = { type: 'despesa', amount: '1.234,50', category: 'Moradia', date: '2026-11-05', description: ' aluguel ' };
r = await tx.onRequestPost({ request: req('/api/transactions', A, 'POST', good), env });
assert.equal(r.status, 201); const id1 = (await r.json()).id;
await tx.onRequestPost({ request: req('/api/transactions', A, 'POST', { type: 'receita', amount: '5000', category: 'Salário', date: '2026-11-01' }), env });
await tx.onRequestPost({ request: req('/api/transactions', A, 'POST', { type: 'despesa', amount: 25.9, category: 'Lazer', date: '2026-10-20' }), env });
await tx.onRequestPost({ request: req('/api/transactions', B, 'POST', { type: 'receita', amount: '1', category: 'Outros', date: '2026-11-01' }), env });

assert.deepEqual((await (await tx.onRequestGet({ request: req('/api/transactions', A), env })).json()).byCategory, [
  { category: 'Moradia', total: 123450 }, { category: 'Lazer', total: 2590 }]);
// validações
const bads = [
  { ...good, amount: '0' }, { ...good, amount: '-5' }, { ...good, amount: 'abc' }, { ...good, amount: '1,234' }, { ...good, amount: '' },
  { ...good, amount: '99999999999' }, { ...good, type: 'x' }, { ...good, category: 'Salário' }, { ...good, date: '2026-02-30' },
  { ...good, date: '05/11/2026' }, { ...good, description: 'a'.repeat(81) }, { ...good, description: 5 }, null,
];
for (const b of bads) {
  const rr = await tx.onRequestPost({ request: req('/api/transactions', A, 'POST', b), env });
  assert.equal(rr.status, 400, JSON.stringify(b));
}
assert.equal((await tx.onRequestPost({ request: new Request(O + '/api/transactions', { method: 'POST', headers: { Cookie: A }, body: '{oops' }), env })).status, 400);
// CSRF
assert.equal((await tx.onRequestPost({ request: req('/api/transactions', A, 'POST', good, { Origin: 'https://evil.com' }), env })).status, 403);

// leitura e filtros
j = await (await tx.onRequestGet({ request: req('/api/transactions', A), env })).json();
assert.equal(j.items.length, 3);
assert.deepEqual(j.balance, { income: 500000, expense: 123450 + 2590, net: 500000 - 126040 });
assert.equal(j.items[0].date, '2026-11-05'); assert.equal(j.items[0].amount_cents, 123450); assert.equal(j.items[0].description, 'aluguel');
j = await (await tx.onRequestGet({ request: req('/api/transactions?month=2026-10', A), env })).json();
assert.equal(j.items.length, 1); assert.equal(j.balance.net, 500000 - 126040, 'saldo é geral, não filtrado');
j = await (await tx.onRequestGet({ request: req('/api/transactions?category=Moradia', A), env })).json();
assert.equal(j.items.length, 1);
assert.equal((await tx.onRequestGet({ request: req('/api/transactions?month=2026-13', A), env })).status, 400);
assert.equal((await tx.onRequestGet({ request: req('/api/transactions?category=Foo', A), env })).status, 400);
j = await (await tx.onRequestGet({ request: req('/api/transactions', B), env })).json();
assert.equal(j.items.length, 1); // isolamento

// mais de 500 transações: lista cortada, gráfico e total continuam corretos
for (let i = 0; i < 501; i++) db.prepare("INSERT INTO transactions (user_id, type, amount_cents, category, description, date) VALUES ('999', 'despesa', 100, 'Lazer', 'x', '2026-09-01')").run();
j = await (await tx.onRequestGet({ request: req('/api/transactions', B), env })).json();
assert.equal(j.items.length, 500); assert.equal(j.truncated, true);
assert.deepEqual(j.byCategory, [{ category: 'Lazer', total: 50100 }]); assert.equal(j.balance.expense, 50100);
// falha no banco durante o login não vira "erro do Discord"
{ const quiet = console.error; console.error = () => {};
  const rr = await cb.onRequestGet({ request: new Request(`${O}/cb?code=c&state=abc`, { headers: { Cookie: 'oauth_state=abc' } }), env: { ...env, DB: { prepare() { throw new Error('db down'); } } } });
  console.error = quiet; assert.ok(rr.headers.get('Location').includes('erro=servidor')); }
// update / delete + isolamento
let p = { id: String(id1) };
r = await txid.onRequestPut({ request: req('/x', B, 'PUT', good), env, params: p }); assert.equal(r.status, 404);
r = await txid.onRequestDelete({ request: req('/x', B, 'DELETE'), env, params: p }); assert.equal(r.status, 404);
r = await txid.onRequestPut({ request: req('/x', A, 'PUT', { ...good, amount: '10', type: 'receita', category: 'Outros' }), env, params: p }); assert.equal(r.status, 200);
j = await (await tx.onRequestGet({ request: req('/api/transactions', A), env })).json();
assert.equal(j.balance.income, 501000);
r = await txid.onRequestPut({ request: req('/x', A, 'PUT', { ...good, amount: '0' }), env, params: p }); assert.equal(r.status, 400);
r = await txid.onRequestPut({ request: req('/x', A, 'PUT', good), env, params: { id: 'abc' } }); assert.equal(r.status, 404);
r = await txid.onRequestDelete({ request: req('/x', A, 'DELETE'), env, params: p }); assert.equal(r.status, 200);
r = await txid.onRequestDelete({ request: req('/x', A, 'DELETE'), env, params: p }); assert.equal(r.status, 404);

// parser
const c = lib.parseAmountToCents;
assert.deepEqual([c('25,90'), c('25.9'), c('1.234,56'), c('1.500'), c('0,01'), c('1000000'), c('0'), c('1,234,5')], [2590, 2590, 123456, 150000, 1, 100000000, null, null]);

// logout
r = await logout.onRequestPost({ request: req('/api/auth/logout', A, 'POST'), env }); assert.equal(r.status, 200);
assert.equal((await me.onRequestGet({ request: req('/api/me', A), env })).status, 401);
// cookie malformado deve dar 401, não erro 500
assert.equal((await me.onRequestGet({ request: req('/api/me', 'sid=%E0%A4%A'), env })).status, 401);
// sessão expirada
db.exec('UPDATE sessions SET expires_at = 1');
assert.equal((await me.onRequestGet({ request: req('/api/me', B), env })).status, 401);
console.log('BACKEND OK');
