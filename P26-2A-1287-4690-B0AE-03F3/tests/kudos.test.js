import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeD1 } from './helpers/fake-d1.js';
import * as kudos from '../functions/api/kudos.js';
import * as me from '../functions/api/me.js';
import * as users from '../functions/api/users.js';
import * as badges from '../functions/api/badges.js';
import * as logout from '../functions/api/auth/logout.js';
import { sha256Hex } from '../functions/_lib/session.js';

const ORIGIN = 'https://kudos.test';
let env;

async function addUser(id, username) {
  await env.DB.prepare('INSERT INTO users (id, username, avatar, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, username, `https://cdn/${id}.png`, new Date().toISOString()).run();
}
async function login(userId, token = 'tok-' + userId, expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), userId, expiresAt).run();
  return `kb_session=${token}`;
}
const req = (path, { method = 'GET', cookie, body, raw } = {}) =>
  new Request(ORIGIN + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body || raw ? { 'Content-Type': 'application/json' } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
const post = (cookie, body, raw) => kudos.onRequestPost({ request: req('/api/kudos', { method: 'POST', cookie, body, raw }), env });
const get = (qs = '') => kudos.onRequestGet({ request: req('/api/kudos' + qs), env });

beforeEach(async () => {
  env = { DB: createFakeD1() };
  await addUser('1', 'Ana');
  await addUser('2', 'Bruno');
  await addUser('3', 'Carla');
});

describe('POST /api/kudos', () => {
  test('sem sessão -> 401', async () => {
    const r = await post(undefined, { to_user_id: '2', badge: 'mentoria', message: 'oi' });
    assert.equal(r.status, 401);
  });
  test('sessão expirada -> 401', async () => {
    const c = await login('1', 'old', Math.floor(Date.now() / 1000) - 10);
    const r = await post(c, { to_user_id: '2', badge: 'mentoria', message: 'oi' });
    assert.equal(r.status, 401);
  });
  test('cookie com token desconhecido -> 401', async () => {
    const r = await post('kb_session=nope', { to_user_id: '2', badge: 'mentoria', message: 'oi' });
    assert.equal(r.status, 401);
  });
  test('JSON inválido / campos ausentes -> 400', async () => {
    const c = await login('1');
    assert.equal((await post(c, undefined, '{nao json')).status, 400);
    assert.equal((await post(c, { badge: 'mentoria', message: 'x' })).status, 400);
  });
  test('selo inválido -> 400', async () => {
    const c = await login('1');
    assert.equal((await post(c, { to_user_id: '2', badge: 'xyz', message: 'oi' })).status, 400);
  });
  test('mensagem vazia/espaços -> 400', async () => {
    const c = await login('1');
    assert.equal((await post(c, { to_user_id: '2', badge: 'mentoria', message: '' })).status, 400);
    assert.equal((await post(c, { to_user_id: '2', badge: 'mentoria', message: '   ' })).status, 400);
  });
  test('mensagem > 280 -> 400; exatamente 280 -> 201', async () => {
    const c = await login('1');
    assert.equal((await post(c, { to_user_id: '2', badge: 'mentoria', message: 'a'.repeat(281) })).status, 400);
    assert.equal((await post(c, { to_user_id: '2', badge: 'mentoria', message: 'a'.repeat(280) })).status, 201);
  });
  test('kudo para si mesmo -> 400 e nada gravado', async () => {
    const c = await login('1');
    const r = await post(c, { to_user_id: '1', badge: 'mentoria', message: 'eu mesmo' });
    assert.equal(r.status, 400);
    const n = env.DB.raw.prepare('SELECT COUNT(*) AS n FROM kudos').get().n;
    assert.equal(n, 0);
  });
  test('CHECK do banco rejeita from = to', async () => {
    await assert.rejects(
      env.DB.prepare('INSERT INTO kudos (from_user_id, to_user_id, badge, message, created_at) VALUES (?,?,?,?,?)')
        .bind('1', '1', 'mentoria', 'x', 'now').run(),
      /CHECK/i
    );
  });
  test('destinatário inexistente -> 404', async () => {
    const c = await login('1');
    assert.equal((await post(c, { to_user_id: '999', badge: 'mentoria', message: 'oi' })).status, 404);
  });
  test('remetente forjado no body é ignorado', async () => {
    const c = await login('1');
    const r = await post(c, { to_user_id: '2', badge: 'mentoria', message: 'oi', from_user_id: '3', from: { id: '3' } });
    assert.equal(r.status, 201);
    const { kudo } = await r.json();
    assert.equal(kudo.from.id, '1');
    assert.equal(kudo.to.id, '2');
    assert.equal(env.DB.raw.prepare('SELECT from_user_id f FROM kudos').get().f, '1');
  });
  test('sucesso: 201 com formato do contrato', async () => {
    const c = await login('1');
    const r = await post(c, { to_user_id: '2', badge: 'code-review', message: '  valeu  ' });
    assert.equal(r.status, 201);
    assert.match(r.headers.get('content-type'), /application\/json/);
    const { kudo } = await r.json();
    assert.equal(typeof kudo.id, 'number');
    assert.equal(kudo.message, 'valeu');
    assert.equal(kudo.badge_label, 'Code Review Excelente');
    assert.equal(kudo.badge_emoji, '🔍');
    assert.deepEqual(kudo.from, { id: '1', username: 'Ana', avatar: 'https://cdn/1.png' });
    assert.equal(kudo.to.username, 'Bruno');
    assert.ok(kudo.created_at);
  });
  test('<script> é guardado como texto puro', async () => {
    const c = await login('1');
    const msg = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const r = await post(c, { to_user_id: '2', badge: 'mentoria', message: msg });
    assert.equal(r.status, 201);
    assert.equal(env.DB.raw.prepare('SELECT message m FROM kudos').get().m, msg);
    const list = await (await get()).json();
    assert.equal(list.kudos[0].message, msg);
  });
});

describe('GET /api/kudos', () => {
  beforeEach(async () => {
    const c1 = await login('1'), c2 = await login('2'), c3 = await login('3');
    await post(c1, { to_user_id: '2', badge: 'mentoria', message: 'a->b' });
    await post(c2, { to_user_id: '1', badge: 'mentoria', message: 'b->a' });
    await post(c3, { to_user_id: '1', badge: 'mentoria', message: 'c->a' });
    await post(c1, { to_user_id: '3', badge: 'mentoria', message: 'a->c' });
  });
  const msgs = async (qs) => (await (await get(qs)).json()).kudos.map((k) => k.message);

  test('público (sem sessão), mais recentes primeiro', async () => {
    assert.deepEqual(await msgs(''), ['a->c', 'c->a', 'b->a', 'a->b']);
  });
  test('received por usuário', async () => {
    assert.deepEqual(await msgs('?filter=received&user=1'), ['c->a', 'b->a']);
    assert.deepEqual(await msgs('?filter=received&user=2'), ['a->b']);
  });
  test('sent por usuário', async () => {
    assert.deepEqual(await msgs('?filter=sent&user=1'), ['a->c', 'a->b']);
    assert.deepEqual(await msgs('?filter=sent&user=3'), ['c->a']);
  });
  test('filter sem user -> 400; filter inválido -> 400', async () => {
    assert.equal((await get('?filter=received')).status, 400);
    assert.equal((await get('?filter=foo')).status, 400);
  });
  test('limit e before (paginação)', async () => {
    const first = (await (await get('?limit=2')).json()).kudos;
    assert.equal(first.length, 2);
    const rest = (await (await get(`?limit=10&before=${first[1].id}`)).json()).kudos;
    assert.deepEqual(rest.map((k) => k.message), ['b->a', 'a->b']);
    assert.equal((await get('?limit=0')).status, 400);
    assert.equal((await get('?limit=101')).status, 400);
  });
});

describe('outros endpoints', () => {
  test('/api/me: 401 sem sessão, 200 com sessão (sem vazar campos extras)', async () => {
    assert.equal((await me.onRequestGet({ request: req('/api/me'), env })).status, 401);
    const c = await login('1');
    const r = await me.onRequestGet({ request: req('/api/me', { cookie: c }), env });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { user: { id: '1', username: 'Ana', avatar: 'https://cdn/1.png' } });
  });
  test('/api/users: 401 sem sessão; exclui o logado e ordena', async () => {
    assert.equal((await users.onRequestGet({ request: req('/api/users'), env })).status, 401);
    const c = await login('2');
    const body = await (await users.onRequestGet({ request: req('/api/users', { cookie: c }), env })).json();
    assert.deepEqual(body.users.map((u) => u.username), ['Ana', 'Carla']);
  });
  test('/api/badges: 6 selos públicos', async () => {
    const body = await (await badges.onRequestGet()).json();
    assert.equal(body.badges.length, 6);
    assert.deepEqual(Object.keys(body.badges[0]).sort(), ['emoji', 'id', 'label']);
  });
  test('logout apaga sessão e cookie', async () => {
    const c = await login('1');
    const r = await logout.onRequestPost({ request: req('/api/auth/logout', { method: 'POST', cookie: c }), env });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await me.onRequestGet({ request: req('/api/me', { cookie: c }), env })).status, 401);
  });
});
