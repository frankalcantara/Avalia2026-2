import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { onRequest as apiMiddleware } from '../functions/api/_middleware.js';
import { onRequestGet as discordLogin } from '../functions/api/auth/discord.js';
import { onRequestGet as discordCallback } from '../functions/api/auth/discord/callback.js';
import { onRequestGet as session } from '../functions/api/session.js';
import { onRequestPost as logout } from '../functions/api/logout.js';
import { onRequestGet as items } from '../functions/api/items.js';
import { onRequestGet as history, onRequestPost as movement } from '../functions/api/movements.js';

const origin = 'https://almoxarifado.example';
const profile = { id: '123456789012345678', username: 'bancada_teste', avatar: '0123456789abcdef0123456789abcdef' };
const routes = {
  'GET /api/auth/discord': discordLogin,
  'GET /api/auth/discord/callback': discordCallback,
  'GET /api/session': session,
  'POST /api/logout': logout,
  'GET /api/items': items,
  'GET /api/movements': history,
  'POST /api/movements': movement
};

function sqliteBinding(db) {
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      function bind(...parameters) {
        return {
          first(column) {
            const row = statement.get(...parameters);
            return column === undefined ? row ?? null : row?.[column] ?? null;
          },
          all() {
            return { success: true, results: statement.all(...parameters) };
          },
          run() {
            const result = statement.run(...parameters);
            return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
          }
        };
      }
      return { ...bind(), bind };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.all());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

function createApp(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const directory = new URL('../migrations/', import.meta.url);
  for (const filename of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(filename, directory), 'utf8'));
  }
  const env = {
    DB: sqliteBinding(db),
    DISCORD_CLIENT_ID: '987654321012345678',
    DISCORD_CLIENT_SECRET: 'credencial-local-de-teste',
    SESSION_SECRET: 'segredo-exclusivo-da-suite-de-testes-local'
  };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    calls.push(url.pathname);
    if (url.pathname.endsWith('/oauth2/token')) {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.equal(form.get('code'), 'codigo-emitido-pelo-discord');
      assert.equal(form.get('redirect_uri'), `${origin}/api/auth/discord/callback`);
      return Response.json({ access_token: 'token-temporario-de-teste' });
    }
    assert.ok(url.pathname.endsWith('/users/@me'));
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer token-temporario-de-teste');
    return Response.json(profile);
  });
  const cookiePair = (response, prefix) => {
    const cookie = response.headers.getSetCookie().find(value => value.startsWith(prefix));
    assert.ok(cookie, `Cookie esperado: ${prefix}`);
    assert.match(cookie, /;\s*HttpOnly(?:;|$)/i);
    assert.match(cookie, /;\s*Secure(?:;|$)/i);
    return cookie.split(';', 1)[0];
  };
  function request(path, { method = 'GET', cookie, body } = {}) {
    const url = new URL(path, origin);
    const headers = new Headers();
    if (cookie) headers.set('Cookie', cookie);
    if (method === 'POST') headers.set('Origin', origin);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const handler = routes[`${method} ${url.pathname}`];
    const context = {
      env,
      request: new Request(url, { method, headers, body: JSON.stringify(body) }),
      data: {},
      waitUntil() {}
    };
    return apiMiddleware({ ...context, next: () => handler(context) });
  }
  async function beginLogin() {
    const response = await request('/api/auth/discord');
    const authorization = new URL(response.headers.get('location'));
    assert.equal(authorization.hostname, 'discord.com');
    assert.match(authorization.pathname, /\/oauth2\/authorize$/);
    assert.equal(authorization.searchParams.get('scope'), 'identify');
    assert.equal(authorization.searchParams.get('redirect_uri'), `${origin}/api/auth/discord/callback`);
    const state = authorization.searchParams.get('state');
    assert.ok(state);
    return { state, cookie: cookiePair(response, 'almoxarifado_oauth=') };
  }
  async function signIn() {
    const { state, cookie } = await beginLogin();
    const query = new URLSearchParams({ code: 'codigo-emitido-pelo-discord', state });
    const response = await request(`/api/auth/discord/callback?${query}`, { cookie });
    assert.equal(new URL(response.headers.get('location'), origin).pathname, '/');
    assert.equal(new URL(response.headers.get('location'), origin).search, '');
    return cookiePair(response, 'almoxarifado_session=');
  }
  return { calls, request, beginLogin, signIn };
}

function postMovement(request, cookie, item, type, quantity, requestId = crypto.randomUUID()) {
  return request('/api/movements', {
    method: 'POST', cookie, body: { item_id: item.id, type, quantity, request_id: requestId }
  });
}

async function getItem(request, cookie, predicate) {
  const response = await request('/api/items', { cookie });
  assert.equal(response.status, 200);
  const { items: stock } = await response.json();
  const item = stock.find(predicate);
  assert.ok(item);
  return item;
}

test('Discord OAuth2 importa o perfil e o logout encerra a sessão', async t => {
  const { request, signIn, calls } = createApp(t);
  assert.deepEqual(await (await request('/api/session')).json(), { user: null });
  assert.equal((await request('/api/items')).status, 401);
  assert.equal((await request('/api/movements')).status, 401);
  assert.equal((await postMovement(request, null, { id: 1 }, 'withdrawal', 1)).status, 401);
  const cookie = await signIn();
  const { user } = await (await request('/api/session', { cookie })).json();
  assert.equal(user.user_id, profile.id);
  assert.equal(user.username, profile.username);
  assert.match(user.avatar_url, new RegExp(`/avatars/${profile.id}/${profile.avatar}`));
  assert.equal(calls.length, 2);
  const end = await request('/api/logout', { method: 'POST', cookie });
  assert.equal(end.status, 200);
  assert.deepEqual(await end.json(), { ok: true });
  assert.equal((await request('/api/items', { cookie })).status, 401);
});

test('Cancelar a autorização do Discord preserva o estado deslogado', async t => {
  const { request, beginLogin, calls } = createApp(t);
  const { state, cookie } = await beginLogin();
  const query = new URLSearchParams({ error: 'access_denied', state });
  const response = await request(`/api/auth/discord/callback?${query}`, { cookie });
  const location = new URL(response.headers.get('location'), origin);
  assert.equal(location.searchParams.get('auth'), 'denied');
  assert.equal(calls.length, 0);
  assert.deepEqual(await (await request('/api/session', { cookie })).json(), { user: null });
});

test('Retirada no limite crítico, repetição segura, devolução e auditoria', async t => {
  const { request, signIn } = createApp(t);
  const cookie = await signIn();
  const initial = await getItem(request, cookie, item => item.quantity > item.minimum_quantity);
  const quantity = initial.quantity - initial.minimum_quantity;
  const requestId = crypto.randomUUID();
  const first = await postMovement(request, cookie, initial, 'withdrawal', quantity, requestId);
  assert.equal(first.status, 201);
  const { item: critical, movement: withdrawal } = await first.json();
  assert.equal(critical.quantity, initial.minimum_quantity);
  assert.equal(withdrawal.user_id, profile.id);
  assert.equal(withdrawal.item_id, initial.id);
  assert.equal(withdrawal.quantity, quantity);
  const replay = await postMovement(request, cookie, initial, 'withdrawal', quantity, requestId);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).movement.id, withdrawal.id);
  assert.equal((await postMovement(request, cookie, initial, 'return', 1, requestId)).status, 409);
  const returned = await postMovement(request, cookie, initial, 'return', quantity);
  assert.equal(returned.status, 201);
  assert.equal((await returned.json()).item.quantity, initial.quantity);
  assert.equal((await getItem(request, cookie, row => row.id === initial.id)).quantity, initial.quantity);
  const results = await request('/api/movements', { cookie });
  assert.equal(results.status, 200);
  const { movements } = await results.json();
  assert.equal(movements.length, 2);
  assert.deepEqual(movements.map(row => row.type), ['return', 'withdrawal']);
  for (const row of movements) {
    assert.equal(row.item_id, initial.id);
    assert.equal(row.item_name, initial.name);
    assert.equal(row.quantity, quantity);
    assert.equal(row.user_id, profile.id);
    assert.equal(row.username, profile.username);
    assert.ok(Number.isFinite(Date.parse(row.created_at)));
  }
});

test('Quantidades inválidas e saldo insuficiente preservam estoque e histórico', async t => {
  const { request, signIn } = createApp(t);
  const cookie = await signIn();
  const item = await getItem(request, cookie, row => row.quantity > 0);
  for (const quantity of [0, -1, 1.5, '2']) {
    assert.equal((await postMovement(request, cookie, item, 'withdrawal', quantity)).status, 400);
  }
  assert.equal((await postMovement(request, cookie, { id: 999999 }, 'withdrawal', 1)).status, 404);
  assert.equal((await postMovement(request, cookie, item, 'withdrawal', item.quantity + 1)).status, 409);
  assert.equal((await getItem(request, cookie, row => row.id === item.id)).quantity, item.quantity);
  assert.deepEqual((await (await request('/api/movements', { cookie })).json()).movements, []);
  const simultaneous = await Promise.all([
    postMovement(request, cookie, item, 'withdrawal', item.quantity),
    postMovement(request, cookie, item, 'withdrawal', item.quantity)
  ]);
  assert.deepEqual(simultaneous.map(response => response.status).sort(), [201, 409]);
  assert.equal((await getItem(request, cookie, row => row.id === item.id)).quantity, 0);
  assert.equal((await (await request('/api/movements', { cookie })).json()).movements.length, 1);
});
