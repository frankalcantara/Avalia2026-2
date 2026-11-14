import test from 'node:test';
import assert from 'node:assert/strict';
import { migratedDatabase, curriculum } from './d1-adapter.mjs';
import { onRequest as startDiscord } from '../functions/api/auth/discord.js';
import { onRequest as callbackDiscord } from '../functions/api/auth/discord/callback.js';
import { onRequest as sessionRoute } from '../functions/api/session.js';
import { onRequest as curriculumRoute } from '../functions/api/curriculum.js';
import { onRequest as logoutRoute } from '../functions/api/logout.js';
import { onRequest as statusRoute } from '../functions/api/status.js';
import { signValue, verifySignedValue, validateCurriculum } from '../functions/_lib.js';

const ORIGIN = 'https://curriculo-test.pages.dev';
const USER_A = '111111111111111111';
const USER_B = '222222222222222222';
const TEST_SECRET = 'test-only-not-a-production-secret-0123456789';

async function environment(t) {
  const DB = await migratedDatabase();
  t.after(() => DB.close());
  return { DB, SESSION_SECRET: TEST_SECRET, DISCORD_CLIENT_ID: '333333333333333333', DISCORD_CLIENT_SECRET: 'test-only-client-secret' };
}

function context(env, path, options = {}) {
  return { env, request: new Request(ORIGIN + path, options) };
}

function cookies(response) {
  return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}

async function login(t, env, userId = USER_A) {
  const start = await startDiscord(context(env, '/api/auth/discord'));
  assert.equal(start.status, 302);
  const authorizeUrl = new URL(start.headers.get('Location'));
  assert.equal(authorizeUrl.origin, 'https://discord.com');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'identify');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), ORIGIN + '/api/auth/discord/callback');
  const state = authorizeUrl.searchParams.get('state');
  assert.ok(state && state.length >= 32);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, options });
    if (url.endsWith('/oauth2/token')) {
      assert.equal(options.method, 'POST');
      return Response.json({ access_token: 'test-only-discord-access-token', token_type: 'Bearer', expires_in: 3600 });
    }
    if (url.endsWith('/users/@me')) {
      assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-only-discord-access-token');
      return Response.json({ id: userId, username: 'usuario_de_teste', global_name: 'Pessoa de Teste', avatar: null });
    }
    throw new Error('Unexpected network call in isolated QA: ' + url);
  };
  let response;
  try {
    response = await callbackDiscord(context(env, '/api/auth/discord/callback?code=test-code&state=' + encodeURIComponent(state), {
      headers: { Cookie: cookies(start) },
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(response.status, 302, 'OAuth callback should redirect after verified Discord identity');
  assert.equal(calls.length, 2, 'Token exchange and Discord user lookup must both execute');
  const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-portfolio_session='));
  assert.ok(sessionCookie, 'Authenticated session cookie must exist');
  assert.match(sessionCookie, /HttpOnly/i);
  assert.match(sessionCookie, /Secure/i);
  assert.match(sessionCookie, /SameSite=Lax/i);
  const cookie = sessionCookie.split(';')[0];
  const sessionResponse = await sessionRoute(context(env, '/api/session', { headers: { Cookie: cookie } }));
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  assert.equal(session.user.user_id, userId);
  assert.ok(session.csrf_token);
  assert.ok(!JSON.stringify(session).includes('access-token'));
  return { cookie, csrf: session.csrf_token, session };
}

function headers(auth, extra = {}) {
  return { Cookie: auth.cookie, Origin: ORIGIN, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrf, ...extra };
}

async function save(env, auth, body) {
  return curriculumRoute(context(env, '/api/curriculum', { method: 'PUT', headers: headers(auth), body: JSON.stringify(body) }));
}

test('Anonymous visitors cannot read private editor data or mutate a curriculum', async t => {
  const env = await environment(t);
  const session = await sessionRoute(context(env, '/api/session'));
  assert.deepEqual(await session.json(), { user: null });
  assert.equal((await curriculumRoute(context(env, '/api/curriculum'))).status, 401);
  assert.equal((await curriculumRoute(context(env, '/api/curriculum', { method: 'PUT', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(curriculum()) }))).status, 401);
  assert.equal((await logoutRoute(context(env, '/api/logout', { method: 'POST', headers: { Origin: ORIGIN } }))).status, 401);
});

test('OAuth imports verified Discord identity and never trusts a browser-supplied user ID', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  assert.equal(auth.session.user.username, 'usuario_de_teste');
  assert.ok(auth.session.user.avatar_url.startsWith('https://cdn.discordapp.com/'));
  const response = await save(env, auth, curriculum({ user_id: USER_B, updated_at: 'forged' }));
  assert.equal(response.status, 200);
  const saved = (await response.json()).curriculum;
  assert.equal(saved.user_id, USER_A);
  assert.notEqual(saved.updated_at, 'forged');
});

test('OAuth callback rejects missing or mismatched state before a token exchange', async t => {
  const env = await environment(t);
  let networkCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { networkCalled = true; throw new Error('must not fetch'); };
  try {
    const missing = await callbackDiscord(context(env, '/api/auth/discord/callback?code=test-code'));
    assert.equal(missing.status, 302);
    assert.equal(new URL(missing.headers.get('Location')).searchParams.get('auth_error'), 'invalid_state');
    assert.ok(!cookies(missing).includes('__Host-portfolio_session='));
    const start = await startDiscord(context(env, '/api/auth/discord'));
    const mismatch = await callbackDiscord(context(env, '/api/auth/discord/callback?code=test-code&state=wrong', { headers: { Cookie: cookies(start) } }));
    assert.equal(mismatch.status, 302);
    assert.equal(new URL(mismatch.headers.get('Location')).searchParams.get('auth_error'), 'invalid_state');
    assert.ok(!cookies(mismatch).includes('__Host-portfolio_session='));
    assert.equal(networkCalled, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('All structured sections survive a SQLite roundtrip and drafts stay private', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  const input = curriculum();
  assert.equal((await save(env, auth, input)).status, 200);
  const ownResponse = await curriculumRoute(context(env, '/api/curriculum', { headers: { Cookie: auth.cookie } }));
  assert.equal(ownResponse.status, 200);
  const saved = (await ownResponse.json()).curriculum;
  for (const key of ['profile', 'education', 'experience', 'projects', 'skills', 'links', 'theme', 'is_public']) {
    assert.deepEqual(saved[key], input[key], key + ' must roundtrip');
  }
  assert.equal((await curriculumRoute(context(env, '/api/curriculum?user=' + USER_A))).status, 404);
  assert.equal((await curriculumRoute(context(env, '/api/curriculum?user=' + USER_A, { headers: { Cookie: auth.cookie } }))).status, 404, 'Public route must not expose a draft even to its owner');
});

test('Maximum supported section counts persist within D1 query and binding limits', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  const input = curriculum();
  for (const [name, count] of Object.entries({ education: 20, experience: 20, projects: 20, skills: 50, links: 15 })) {
    input[name] = Array.from({ length: count }, () => ({ ...input[name][0] }));
  }
  const before = env.DB.batches.length;
  const saved = await save(env, auth, input);
  assert.equal(saved.status, 200);
  const batches = env.DB.batches.slice(before);
  assert.ok(batches.reduce((total, statements) => total + statements.length, 0) <= 40, 'Save leaves room below the D1 free-plan query budget');
  for (const statement of batches.flat()) assert.ok(statement.bindCount <= 100, 'SQL statements respect D1 bound-parameter limit');
  const own = await curriculumRoute(context(env, '/api/curriculum', { headers: { Cookie: auth.cookie } }));
  const result = (await own.json()).curriculum;
  for (const name of ['education', 'experience', 'projects', 'skills', 'links']) assert.deepEqual(result[name], input[name]);
});

test('Publishing enables public reads; unpublishing revokes public reads', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  assert.equal((await save(env, auth, curriculum({ is_public: true }))).status, 200);
  const response = await curriculumRoute(context(env, '/api/curriculum?user=' + USER_A));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.curriculum.profile.full_name, 'Pessoa de Teste');
  assert.equal(payload.curriculum.is_public, true);
  for (const forbidden of ['csrf_token', 'token_hash', 'SESSION_SECRET', 'access_token', 'client_secret']) {
    assert.ok(!JSON.stringify(payload).includes(forbidden), 'Public payload must not expose ' + forbidden);
  }
  assert.equal((await save(env, auth, curriculum({ is_public: false }))).status, 200);
  assert.equal((await curriculumRoute(context(env, '/api/curriculum?user=' + USER_A))).status, 404);
});

test('Separate Discord users cannot overwrite each other even with forged ownership', async t => {
  const env = await environment(t);
  const alice = await login(t, env, USER_A);
  const bob = await login(t, env, USER_B);
  await save(env, alice, curriculum({ is_public: true }));
  const bobInput = curriculum({ user_id: USER_A });
  bobInput.profile.full_name = 'Outra Pessoa';
  const saved = await save(env, bob, bobInput);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).curriculum.user_id, USER_B);
  const aliceRead = await curriculumRoute(context(env, '/api/curriculum?user=' + USER_A));
  assert.equal((await aliceRead.json()).curriculum.profile.full_name, 'Pessoa de Teste');
});

test('Mutation endpoints reject absent/wrong CSRF and foreign origins', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  for (const override of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': 'invalid' }, { Origin: 'https://attacker.example' }]) {
    const response = await curriculumRoute(context(env, '/api/curriculum', {
      method: 'PUT', headers: headers(auth, override), body: JSON.stringify(curriculum()),
    }));
    assert.equal(response.status, 403);
  }
  const logout = await logoutRoute(context(env, '/api/logout', { method: 'POST', headers: headers(auth, { 'X-CSRF-Token': 'wrong' }) }));
  assert.equal(logout.status, 403);
});

test('Logout revokes the server-side session and an old cookie is no longer valid', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  const logout = await logoutRoute(context(env, '/api/logout', { method: 'POST', headers: headers(auth) }));
  assert.ok([200, 204].includes(logout.status));
  const session = await sessionRoute(context(env, '/api/session', { headers: { Cookie: auth.cookie } }));
  assert.deepEqual(await session.json(), { user: null });
  assert.equal((await save(env, auth, curriculum())).status, 401);
});

test('Expired and tampered session cookies cannot authenticate a user', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  const tampered = await sessionRoute(context(env, '/api/session', { headers: { Cookie: auth.cookie + 'x' } }));
  assert.deepEqual(await tampered.json(), { user: null });
  await env.DB.prepare('UPDATE sessions SET expires_at = ?').bind('1970-01-01T00:00:00.000Z').run();
  const expired = await sessionRoute(context(env, '/api/session', { headers: { Cookie: auth.cookie } }));
  assert.deepEqual(await expired.json(), { user: null });
  assert.equal((await save(env, auth, curriculum())).status, 401);
});

test('Deleting a Discord user cascades to sessions and structured curriculum records', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  await save(env, auth, curriculum());
  await env.DB.prepare('DELETE FROM discord_users WHERE user_id = ?').bind(USER_A).run();
  for (const name of ['sessions', 'curricula', 'curriculum_education', 'curriculum_experience', 'curriculum_projects', 'curriculum_skills', 'curriculum_links']) {
    assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS count FROM ' + name).get().count, 0, name);
  }
  assert.equal((await save(env, auth, curriculum())).status, 401);
});

test('Validation rejects invalid types, sizes, themes, and executable URL protocols', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  const cases = [
    { ...curriculum(), profile: { ...curriculum().profile, full_name: 'x' } },
    { ...curriculum(), profile: { ...curriculum().profile, full_name: 'x'.repeat(121) } },
    { ...curriculum(), profile: { ...curriculum().profile, website: 'javascript:alert(1)' } },
    { ...curriculum(), links: [{ label: 'Bad link', url: 'data:text/html,<script>alert(1)</script>' }] },
    { ...curriculum(), projects: [{ ...curriculum().projects[0], repository: 'javascript:alert(1)' }] },
    { ...curriculum(), is_public: 'true' },
    { ...curriculum(), theme: 'unrecognized-theme' },
    { ...curriculum(), education: 'not-an-array' },
    { ...curriculum(), education: Array.from({ length: 21 }, () => curriculum().education[0]) },
    { ...curriculum(), skills: Array.from({ length: 51 }, () => curriculum().skills[0]) },
    { ...curriculum(), links: Array.from({ length: 16 }, () => curriculum().links[0]) },
    { ...curriculum(), skills: [{ name: 123, level: 'Intermediário' }] },
    null,
  ];
  for (const input of cases) {
    const response = await save(env, auth, input);
    assert.equal(response.status, 400, 'Invalid input must receive 400: ' + JSON.stringify(input).slice(0, 80));
    const error = await response.json();
    assert.ok(error.error && error.message);
  }
});

test('Invalid JSON and oversized request bodies do not mutate stored curriculum', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  await save(env, auth, curriculum());
  const badJson = await curriculumRoute(context(env, '/api/curriculum', { method: 'PUT', headers: headers(auth), body: '{broken' }));
  assert.equal(badJson.status, 400);
  const oversized = await curriculumRoute(context(env, '/api/curriculum', { method: 'PUT', headers: headers(auth), body: JSON.stringify({ padding: 'x'.repeat(300000) }) }));
  assert.equal(oversized.status, 413);
  const own = await curriculumRoute(context(env, '/api/curriculum', { headers: { Cookie: auth.cookie } }));
  assert.equal((await own.json()).curriculum.profile.full_name, 'Pessoa de Teste');
});

test('SQL metacharacters are stored as data and do not affect other rows', async t => {
  const env = await environment(t);
  const auth = await login(t, env);
  const input = curriculum();
  input.profile.full_name = "Teste'); DROP TABLE discord_users; --";
  assert.equal((await save(env, auth, input)).status, 200);
  const own = await curriculumRoute(context(env, '/api/curriculum', { headers: { Cookie: auth.cookie } }));
  assert.equal((await own.json()).curriculum.profile.full_name, input.profile.full_name);
  assert.equal((await sessionRoute(context(env, '/api/session', { headers: { Cookie: auth.cookie } }))).status, 200);
});

test('Signed values cannot be forged by modifying a token or using another secret', async () => {
  const signed = await signValue('a-token-to-protect', TEST_SECRET);
  assert.ok(await verifySignedValue(signed, TEST_SECRET));
  assert.ok(!(await verifySignedValue(signed + 'x', TEST_SECRET)));
  assert.ok(!(await verifySignedValue(signed, 'another-test-secret-with-more-than-32-characters')));
  assert.ok(!(await verifySignedValue('untrusted', TEST_SECRET)));
});

test('Health endpoint reports readiness without leaking users, sessions, or credentials', async t => {
  const env = await environment(t);
  await login(t, env);
  const response = await statusRoute(context(env, '/api/status'));
  assert.equal(response.status, 200);
  const body = JSON.stringify(await response.json());
  for (const secret of [TEST_SECRET, env.DISCORD_CLIENT_SECRET, USER_A, 'pessoa@example.com']) assert.ok(!body.includes(secret));
});

test('Relational migration enables foreign keys and supports an empty curriculum', async t => {
  const env = await environment(t);
  assert.equal(env.DB.sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  const auth = await login(t, env);
  const fresh = await curriculumRoute(context(env, '/api/curriculum', { headers: { Cookie: auth.cookie } }));
  assert.equal(fresh.status, 200);
  const body = await fresh.json();
  assert.equal(body.curriculum.is_public, false);
  for (const field of ['education', 'experience', 'projects', 'skills', 'links']) assert.ok(Array.isArray(body.curriculum[field]));
  assert.doesNotThrow(() => validateCurriculum(curriculum({ education: [], experience: [], projects: [], skills: [], links: [] })));
});
