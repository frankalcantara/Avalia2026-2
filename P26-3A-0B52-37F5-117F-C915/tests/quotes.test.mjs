import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { createSession, SESSION_COOKIE } from '../lib/auth.js';
import * as quotes from '../functions/api/quotes.js';
import * as random from '../functions/api/random.js';
import { onRequestGet as startDiscord } from '../functions/api/auth/discord.js';
import { onRequestGet as finishDiscord } from '../functions/api/auth/discord/callback.js';
import { onRequest as logout } from '../functions/api/auth/logout.js';
import * as me from '../functions/api/me.js';

const origin = 'https://acervo.example';
const secret = 'segredo-efemero-utilizado-apenas-na-suite-local';
const alice = { user_id: '101', username: 'Alice', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' };
const bruno = { user_id: '202', username: 'Bruno', avatar: 'https://cdn.discordapp.com/embed/avatars/1.png' };
const work = {
  text: "O livro de Alice tem uma anotação: 'reler'.",
  author: 'Autora de exemplo', source: 'Caderno', kind: 'livro', page: '12',
  theme: 'Leitura', note: 'Lembrar desta passagem na próxima discussão.', visibility: 'private'
};

function createDatabase(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON');
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, dir), 'utf8'));
  }
  function prepare(sql, args = []) {
    const stmt = db.prepare(sql);
    return {
      bind: (...values) => prepare(sql, values),
      first: async () => stmt.get(...args) ?? null,
      all: async () => ({ success: true, results: stmt.all(...args) }),
      run: async () => {
        const { changes, lastInsertRowid } = stmt.run(...args);
        return { success: true, meta: { changes, last_row_id: lastInsertRowid } };
      }
    };
  }
  const insertUser = db.prepare('INSERT INTO discord_users (user_id, username, avatar) VALUES (?, ?, ?)');
  for (const user of [alice, bruno]) insertUser.run(user.user_id, user.username, user.avatar);
  return { prepare };
}

function client(t) {
  const env = { DB: createDatabase(t), SESSION_SECRET: secret };
  return async function request(route, path, { user, body, method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) {
    const h = new Headers({ Origin: origin, 'Content-Type': 'application/json', ...headers });
    if (user) h.set('Cookie', SESSION_COOKIE + '=' + await createSession(user, secret));
    const request = new Request(origin + path, {
      headers: h, method, body: body === undefined ? undefined : JSON.stringify(body)
    });
    return method === 'POST' ? route.onRequestPost({ request, env }) : route.onRequestGet({ request, env });
  };
}

async function save(request, user, values) {
  const response = await request(quotes, '/api/quotes', { user, body: { ...work, ...values } });
  assert.equal(response.status, 201, await response.text());
}

async function read(response, key) {
  assert.equal(response.status, 200);
  return (await response.json())[key];
}

test('me devolve identidade do Discord validada e reconhece sessão ausente', async t => {
  const request = client(t);
  assert.equal(await read(await request(me, '/api/me'), 'user'), null);
  assert.deepEqual(await read(await request(me, '/api/me', { user: alice }), 'user'), alice);
});

test('feed, acervo pessoal e sorteio respeitam a visibilidade entre duas contas', async t => {
  const request = client(t);
  await save(request, alice, { text: 'Anotação reservada da Alice.' });
  await save(request, bruno, { text: 'Anotação reservada do Bruno.' });
  assert.equal(await read(await request(random, '/api/random'), 'quote'), null);
  await save(request, alice, { text: work.text, visibility: 'public' });
  const publicFeed = await read(await request(quotes, '/api/quotes?scope=public'), 'quotes');
  assert.equal(publicFeed.length, 1);
  const published = publicFeed[0];
  for (const [key, value] of Object.entries({ ...work, visibility: 'public', username: alice.username })) {
    if (key === 'page') assert.equal(String(published.page), String(value));
    else assert.deepEqual(published[key], value, key);
  }
  assert.ok(published.id);
  const brunoFeed = await read(await request(quotes, '/api/quotes?scope=mine', { user: bruno }), 'quotes');
  assert.deepEqual(brunoFeed.map(x => x.text), ['Anotação reservada do Bruno.']);
  const aliceFeed = await read(await request(quotes, '/api/quotes?scope=mine', { user: alice }), 'quotes');
  assert.deepEqual(new Set(aliceFeed.map(x => x.text)), new Set([work.text, 'Anotação reservada da Alice.']));
  const pick = await read(await request(random, '/api/random', { user: bruno }), 'quote');
  assert.equal(pick.id, published.id);
  assert.equal(pick.note, work.note);
});

test('a API rejeita cadastro anônimo e reserva o acervo pessoal ao usuário autenticado', async t => {
  const request = client(t);
  assert.equal((await request(quotes, '/api/quotes', { body: work })).status, 401);
  assert.equal((await request(quotes, '/api/quotes?scope=mine')).status, 401);
});

test('a API rejeita gravação de outra origem e autoria forjada sem persistir o trecho', async t => {
  const request = client(t);
  assert.equal((await request(quotes, '/api/quotes', { user: alice, body: work, headers: { Origin: 'https://outro.example' } })).status, 403);
  const invalid = [{ username: 'Bruno' }, { user_id: bruno.user_id }, { text: '  ' },
    { kind: 'inexistente' }, { visibility: 'qualquer' }, { author: {} }];
  for (const fields of invalid) {
    const response = await request(quotes, '/api/quotes', { user: alice, body: { ...work, ...fields } });
    assert.ok([400, 422].includes(response.status), JSON.stringify(fields));
  }
  assert.deepEqual(await read(await request(quotes, '/api/quotes?scope=mine', { user: alice }), 'quotes'), []);
});

test('artigo exige página e palestra aceita registro sem paginação', async t => {
  const request = client(t);
  const missingPage = await request(quotes, '/api/quotes', { user: alice, body: { ...work, kind: 'artigo', page: '' } });
  assert.equal(missingPage.status, 400);
  await save(request, alice, { kind: 'artigo', page: '23–24' });
  await save(request, alice, { kind: 'palestra', page: '' });
  const all = await read(await request(quotes, '/api/quotes?scope=mine', { user: alice }), 'quotes');
  assert.equal(all.length, 2);
});

test('falha de D1 é comunicada, sem simular salvamento ou acervo vazio', async () => {
  const env = { SESSION_SECRET: secret };
  const request = new Request(origin + '/api/quotes');
  const feed = await quotes.onRequestGet({ env, request });
  const pick = await random.onRequestGet({ env, request });
  assert.equal(feed.status, 503);
  assert.equal(pick.status, 503);
  const create = new Request(origin + '/api/quotes', { method: 'POST', headers: {
    Origin: origin, Cookie: SESSION_COOKIE + '=' + await createSession(alice, secret),
    'Content-Type': 'application/json'
  }, body: JSON.stringify(work) });
  assert.equal((await quotes.onRequestPost({ env, request: create })).status, 503);
});

test('login simulado completa o OAuth, persiste o perfil, salva e encerra a sessão', async t => {
  const env = { DB: createDatabase(t), SESSION_SECRET: secret, DISCORD_CLIENT_ID: '123', DISCORD_CLIENT_SECRET: 'teste' };
  const start = await startDiscord({ env, request: new Request(origin + '/api/auth/discord') });
  assert.equal(start.status, 302);
  const auth = new URL(start.headers.get('Location'));
  assert.equal(auth.origin, 'https://discord.com');
  assert.equal(auth.searchParams.get('scope'), 'identify');
  const callback = new URL(auth.searchParams.get('redirect_uri'));
  assert.equal(callback.href, origin + '/api/auth/discord/callback');
  const stateCookie = start.headers.getSetCookie()[0].split(';')[0];
  callback.searchParams.set('code', 'codigo-local-de-teste');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    calls.push(String(url));
    if (String(url) === 'https://discord.com/api/oauth2/token') {
      assert.equal(opts.body.get('redirect_uri'), origin + '/api/auth/discord/callback');
      return Response.json({ access_token: 'token-local' });
    }
    assert.equal(String(url), 'https://discord.com/api/v10/users/@me');
    assert.equal(opts.headers.Authorization, 'Bearer token-local');
    return Response.json({ id: '303', username: 'Lia', avatar: 'cafe' });
  });
  const finish = () => finishDiscord({ env, request: new Request(callback, { headers: { Cookie: stateCookie } }) });
  callback.searchParams.set('state', 'invalido');
  assert.match((await finish()).headers.get('Location'), /invalid_state/);
  assert.deepEqual(calls, []);
  callback.searchParams.set('state', auth.searchParams.get('state'));
  const logged = await finish();
  assert.equal(logged.status, 302);
  assert.equal(calls.length, 2);
  const setCookie = logged.headers.getSetCookie().find(cookie => cookie.startsWith(SESSION_COOKIE + '='));
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  const headers = { Cookie: setCookie.split(';')[0], Origin: origin, 'Content-Type': 'application/json' };
  const identify = await me.onRequestGet({ env, request: new Request(origin + '/api/me', { headers }) });
  const user = await read(identify, 'user');
  assert.equal(user.user_id, '303');
  assert.equal(user.username, 'Lia');
  assert.match(user.avatar, /avatars\/303\/cafe\.png$/);
  const write = new Request(origin + '/api/quotes', { method: 'POST', headers, body: JSON.stringify(work) });
  assert.equal((await quotes.onRequestPost({ env, request: write })).status, 201);
  const exit = await logout({ env, request: new Request(origin + '/api/auth/logout', { method: 'POST', headers }) });
  assert.equal(exit.status, 200);
  assert.ok(exit.headers.getSetCookie().some(cookie => cookie.startsWith(SESSION_COOKIE + '=') && cookie.includes('Max-Age=0')));
});
