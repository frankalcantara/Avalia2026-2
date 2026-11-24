import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { callFunction, createEnv, mockDiscord, sampleResume, student, visitor } from './fixture.mjs';

const origin = 'https://portfolio.example';

function createClient(env) {
  const cookies = new Map();
  return async (path, options = {}) => {
    const { method = 'GET', body, headers = {} } = options;
    const rawCookie = [...cookies.values()].join('; ');
    const request = new Request(new URL(path, origin), {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(rawCookie ? { Cookie: rawCookie } : {}),
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
    });
    const response = await callFunction(request, env);
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = setCookie.split(';');
      const name = pair.split('=', 1)[0];
      if (attributes.some((attribute) => attribute.trim().toLowerCase() === 'max-age=0')) {
        cookies.delete(name);
      } else {
        cookies.set(name, pair);
      }
    }
    return response;
  };
}

async function authorize(client, code) {
  const authorization = await client('/api/auth/discord');
  assert.equal(authorization.status, 302);
  const redirect = new URL(authorization.headers.get('Location'));
  assert.equal(redirect.origin, 'https://discord.com');
  assert.equal(redirect.searchParams.get('scope'), 'identify');
  assert.equal(redirect.searchParams.get('redirect_uri'), origin + '/api/auth/discord/callback');
  const state = redirect.searchParams.get('state');
  assert.ok(state);
  const stateCookie = authorization.headers.getSetCookie()[0];
  assert.match(stateCookie, /(?:^|;\s*)HttpOnly(?:;|$)/i);
  assert.match(stateCookie, /(?:^|;\s*)Secure(?:;|$)/i);
  return client('/api/auth/discord/callback?' + new URLSearchParams({ code, state }));
}

describe('Currículo e login em SQLite local', () => {
  let restoreFetch;

  before(() => { restoreFetch = mockDiscord(origin); });
  after(() => { restoreFetch(); });

  function fresh(testContext) {
    const context = createEnv();
    testContext.after(() => context.database.close());
    return context;
  }

  test('sessão anônima, leitura privada e escrita sem autenticação', async (testContext) => {
    const { env } = fresh(testContext);
    const client = createClient(env);
    assert.deepEqual(await (await client('/api/session')).json(), { user: null });
    assert.equal((await client('/api/resume')).status, 401);
    assert.equal((await client('/api/resume', { method: 'PUT', body: sampleResume })).status, 401);
    assert.equal((await client('/api/public-resume?user=' + student.id)).status, 404);
  });

  test('login Discord cria sessão e logout a revoga no banco', async (testContext) => {
    const { env } = fresh(testContext);
    const client = createClient(env);
    const callback = await authorize(client, 'student');
    assert.equal(callback.status, 302);
    const cookies = callback.headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('__Host-portfolio_session='));
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /(?:^|;\s*)HttpOnly(?:;|$)/i);
    assert.match(sessionCookie, /(?:^|;\s*)Secure(?:;|$)/i);
    assert.match(sessionCookie, /(?:^|;\s*)SameSite=Lax(?:;|$)/i);
    const { user } = await (await client('/api/session')).json();
    assert.equal(user.id, student.id);
    assert.equal(user.username, student.global_name);
    assert.deepEqual(await (await client('/api/resume')).json(), { resume: null });
    const signOut = await client('/api/auth/logout', { method: 'POST' });
    assert.ok(signOut.ok);
    assert.deepEqual(await (await client('/api/session')).json(), { user: null });
    const oldSession = createClient(env);
    const revoked = await oldSession('/api/session', { headers: { Cookie: sessionCookie.split(';', 1)[0] } });
    assert.deepEqual(await revoked.json(), { user: null });
  });

  test('callback mantém resposta genérica e registra diagnósticos sanitizados no servidor', async (testContext) => {
    const { env } = fresh(testContext);
    const client = createClient(env);
    const log = testContext.mock.method(console, 'error', () => {});
    const failureOf = (r) => {
      assert.equal(r.status, 302);
      return new URL(r.headers.get('Location'), origin).searchParams.get('auth_error');
    };
    const noState = await client('/api/auth/discord/callback?code=student');
    assert.equal(failureOf(noState), 'invalid_state');
    for (const code of ['unknown', 'client-rejected', 'token-unavailable', 'profile-unavailable']) {
      assert.equal(failureOf(await authorize(client, code)), 'discord_failed');
    }
    env.DB.batch = async () => { throw new Error('Falha de D1 simulada'); };
    assert.equal(failureOf(await authorize(client, 'student')), 'discord_failed');
    assert.deepEqual(log.mock.calls.map(call => call.arguments), [
      ['discord_oauth_failure', { stage: 'token_exchange', status: 400, discordError: 'invalid_grant' }],
      ['discord_oauth_failure', { stage: 'token_exchange', status: 401, discordError: 'invalid_client' }],
      ['discord_oauth_failure', { stage: 'token_exchange', status: 502, discordError: 'other' }],
      ['discord_oauth_failure', { stage: 'profile' }],
      ['discord_oauth_failure', { stage: 'session' }],
    ]);
    assert.deepEqual(await (await client('/api/session')).json(), { user: null });
  });

  test('salva campos acadêmicos e só publica os registros marcados como públicos', async (testContext) => {
    const { env } = fresh(testContext);
    const editor = createClient(env);
    const secondEditor = createClient(env);
    const publicClient = createClient(env);
    await authorize(editor, 'student');
    await authorize(secondEditor, 'visitor');

    const savePrivate = await editor('/api/resume', { method: 'PUT', body: sampleResume });
    assert.equal(savePrivate.status, 200, await savePrivate.clone().text());
    assert.deepEqual((await savePrivate.json()).resume, sampleResume);
    assert.deepEqual((await (await editor('/api/resume')).json()).resume, sampleResume);
    assert.deepEqual((await (await secondEditor('/api/resume')).json()).resume, null);
    assert.equal((await publicClient('/api/public-resume?user=' + student.id)).status, 404);

    const publishedResume = { ...sampleResume, published: true };
    assert.equal((await editor('/api/resume', { method: 'PUT', body: publishedResume })).status, 200);
    const publicResume = await publicClient('/api/public-resume?user=' + student.id);
    assert.equal(publicResume.status, 200);
    assert.deepEqual(await publicResume.json(), { resume: publishedResume });
    assert.equal((await publicClient('/api/public-resume?user=' + visitor.id)).status, 404);

    const otherResume = { ...sampleResume, profile: { ...sampleResume.profile, name: 'Segunda estudante' } };
    assert.equal((await secondEditor('/api/resume', { method: 'PUT', body: otherResume })).status, 200);
    assert.deepEqual((await (await editor('/api/resume')).json()).resume, publishedResume);

    assert.equal((await editor('/api/resume', { method: 'PUT', body: sampleResume })).status, 200);
    assert.equal((await publicClient('/api/public-resume?user=' + student.id)).status, 404);
  });

  test('valida dados no servidor e preserva o último currículo íntegro', async (testContext) => {
    const { env } = fresh(testContext);
    const client = createClient(env);
    await authorize(client, 'student');
    assert.equal((await client('/api/resume', { method: 'PUT', body: sampleResume })).status, 200);

    const invalidResumes = [
      { ...sampleResume, theme: 'desconhecido' },
      { ...sampleResume, published: 'sim' },
      { ...sampleResume, profile: { ...sampleResume.profile, email: 'invalido' } },
      { ...sampleResume, colors: { ...sampleResume.colors, accent: 'azul' } },
      { ...sampleResume, education: [{ ...sampleResume.education[0], end: '2020-01' }] },
      { ...sampleResume, links: [{ label: 'Arquivo local', url: 'file:///curriculo.pdf' }] },
    ];
    for (const body of invalidResumes) {
      const response = await client('/api/resume', { method: 'PUT', body });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, 'string');
    }
    assert.deepEqual((await (await client('/api/resume')).json()).resume, sampleResume);
  });

  test('reverte todas as alterações se um item acadêmico não puder ser gravado', async (testContext) => {
    const { env, database } = fresh(testContext);
    const client = createClient(env);
    await authorize(client, 'student');
    assert.equal((await client('/api/resume', { method: 'PUT', body: sampleResume })).status, 200);
    database.exec(`
      CREATE TEMP TRIGGER falha_no_projeto BEFORE INSERT ON resume_projects
      BEGIN
        SELECT RAISE(ABORT, 'Falha de gravação simulada');
      END;
    `);
    const update = {
      ...sampleResume,
      profile: { ...sampleResume.profile, name: 'Nome editado' },
      education: [],
      published: true,
    };
    assert.equal((await client('/api/resume', { method: 'PUT', body: update })).status, 503);
    assert.deepEqual((await (await client('/api/resume')).json()).resume, sampleResume);
    assert.equal((await client('/api/public-resume?user=' + student.id)).status, 404);
  });

  test('uma sessão expirada precisa autenticar novamente', async (testContext) => {
    const { env, database } = fresh(testContext);
    const client = createClient(env);
    await authorize(client, 'student');
    assert.equal((await (await client('/api/session')).json()).user.id, student.id);
    database.prepare('UPDATE portfolio_sessions SET expires_at = ? WHERE user_id = ?').run(0, student.id);
    assert.deepEqual(await (await client('/api/session')).json(), { user: null });
    assert.equal((await client('/api/resume')).status, 401);
  });

  test('exige origem do aplicativo para salvar currículo e sair', async (testContext) => {
    const { env } = fresh(testContext);
    const client = createClient(env);
    await authorize(client, 'student');
    const headers = { Origin: 'https://example.com' };
    assert.equal((await client('/api/resume', { method: 'PUT', body: sampleResume, headers })).status, 403);
    assert.equal((await client('/api/auth/logout', { method: 'POST', headers })).status, 403);
    assert.equal((await (await client('/api/session')).json()).user.id, student.id);
    assert.deepEqual((await (await client('/api/resume')).json()), { resume: null });
  });
});
