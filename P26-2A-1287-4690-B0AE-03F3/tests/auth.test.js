import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeD1 } from './helpers/fake-d1.js';
import * as login from '../functions/api/auth/login.js';
import * as callback from '../functions/api/auth/callback.js';
import { avatarUrl } from '../functions/_lib/discord.js';
import { sha256Hex } from '../functions/_lib/session.js';

const ORIGIN = 'https://kudos.test';
let env, realFetch, calls, discordUser;

beforeEach(() => {
  env = { DB: createFakeD1(), DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec' };
  calls = [];
  discordUser = { id: '80351110224678912', username: 'nelly', global_name: 'Nelly', avatar: 'abc123' };
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    if (String(url) === 'https://discord.com/api/oauth2/token')
      return new Response(JSON.stringify({ access_token: 'AT' }), { status: 200 });
    if (String(url) === 'https://discord.com/api/users/@me')
      return new Response(JSON.stringify(discordUser), { status: 200 });
    return new Response('{}', { status: 404 });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const doLogin = async (origin = ORIGIN) => {
  const r = await login.onRequestGet({ request: new Request(origin + '/api/auth/login'), env });
  return { r, state: new URL(r.headers.get('location')).searchParams.get('state') };
};
const doCallback = (qs) => callback.onRequestGet({ request: new Request(ORIGIN + '/api/auth/callback' + qs), env });

describe('OAuth', () => {
  test('login: 302 para o Discord com parâmetros corretos e state persistido', async () => {
    const { r, state } = await doLogin();
    assert.equal(r.status, 302);
    const u = new URL(r.headers.get('location'));
    assert.equal(u.origin + u.pathname, 'https://discord.com/oauth2/authorize');
    assert.equal(u.searchParams.get('client_id'), 'cid');
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.equal(u.searchParams.get('scope'), 'identify');
    assert.equal(u.searchParams.get('redirect_uri'), ORIGIN + '/api/auth/callback');
    assert.match(state, /^[0-9a-f]{32}$/);
    assert.ok(env.DB.raw.prepare('SELECT 1 FROM oauth_states WHERE state=?').get(state));
  });

  test('callback feliz: cria usuário, sessão (hash) e cookie; consome state', async () => {
    const { state } = await doLogin();
    const r = await doCallback(`?code=XYZ&state=${state}`);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/');
    const cookie = r.headers.get('set-cookie');
    assert.match(cookie, /^kb_session=[0-9a-f]{64};/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=604800/);
    assert.match(cookie, /Secure/);
    const token = cookie.match(/kb_session=([0-9a-f]+)/)[1];
    const sess = env.DB.raw.prepare('SELECT * FROM sessions').get();
    assert.equal(sess.token_hash, await sha256Hex(token));
    assert.notEqual(sess.token_hash, token);
    const u = env.DB.raw.prepare('SELECT * FROM users').get();
    assert.equal(u.id, discordUser.id);
    assert.equal(u.username, 'Nelly');
    assert.equal(u.avatar, `https://cdn.discordapp.com/avatars/${discordUser.id}/abc123.png?size=128`);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM oauth_states').get().n, 0);
    const tok = calls.find((c) => c.url.endsWith('/oauth2/token'));
    const body = new URLSearchParams(tok.opts.body);
    assert.equal(body.get('code'), 'XYZ');
    assert.equal(body.get('redirect_uri'), ORIGIN + '/api/auth/callback');
    assert.equal(calls.find((c) => c.url.endsWith('/users/@me')).opts.headers.Authorization, 'Bearer AT');
  });

  test('cookie sem Secure em localhost', async () => {
    const { state } = await doLogin('http://localhost:8788');
    const r = await callback.onRequestGet({ request: new Request(`http://localhost:8788/api/auth/callback?code=c&state=${state}`), env });
    assert.equal(r.status, 302);
    assert.doesNotMatch(r.headers.get('set-cookie'), /Secure/);
  });

  test('state reutilizado é rejeitado', async () => {
    const { state } = await doLogin();
    assert.equal((await doCallback(`?code=c&state=${state}`)).headers.get('location'), '/');
    const r2 = await doCallback(`?code=c&state=${state}`);
    assert.equal(r2.headers.get('location'), '/?erro=login');
    assert.equal(r2.headers.get('set-cookie'), null);
  });

  test('state inexistente/ausente é rejeitado sem chamar o Discord', async () => {
    assert.equal((await doCallback('?code=c&state=forjado')).headers.get('location'), '/?erro=login');
    assert.equal((await doCallback('?code=c')).headers.get('location'), '/?erro=login');
    assert.equal((await doCallback('?state=x')).headers.get('location'), '/?erro=login');
    assert.equal(calls.length, 0);
  });

  test('state expirado é rejeitado', async () => {
    env.DB.raw.prepare('INSERT INTO oauth_states (state, expires_at) VALUES (?, ?)').run('velho', Math.floor(Date.now() / 1000) - 1);
    const r = await doCallback('?code=c&state=velho');
    assert.equal(r.headers.get('location'), '/?erro=login');
    assert.equal(calls.length, 0);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  });

  test('falha do Discord -> /?erro=login, sem sessão', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 400 });
    const { state } = await doLogin();
    const r = await doCallback(`?code=c&state=${state}`);
    assert.equal(r.headers.get('location'), '/?erro=login');
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  });

  test('upsert atualiza username/avatar; fallback username e avatar padrão', async () => {
    let { state } = await doLogin();
    await doCallback(`?code=c&state=${state}`);
    discordUser = { id: '80351110224678912', username: 'nelly_u', global_name: null, avatar: null };
    ({ state } = await doLogin());
    await doCallback(`?code=c&state=${state}`);
    const rows = env.DB.raw.prepare('SELECT * FROM users').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].username, 'nelly_u');
    const idx = Number((80351110224678912n >> 22n) % 6n);
    assert.equal(rows[0].avatar, `https://cdn.discordapp.com/embed/avatars/${idx}.png`);
    assert.equal(avatarUrl({ id: '80351110224678912', avatar: null }), rows[0].avatar);
  });
});
