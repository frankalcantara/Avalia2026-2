import test from 'node:test';
import assert from 'node:assert/strict';

import { signSession, verifySession } from '../lib/session.js';
import { onRequestGet as getMe } from '../functions/api/auth/me.js';
import { onRequestGet as discordLoginAlias } from '../functions/api/auth/discord.js';
import { onRequestGet as discordCallbackAlias } from '../functions/api/auth/discord/callback.js';
import { onRequestGet as getLogs, onRequestPost as postLogs } from '../functions/api/logs.js';

const TEST_SECRET = 'segredo-de-teste-hmac-2026';

function createMockD1(initialRows = []) {
  const rows = initialRows.map((r) => ({ ...r }));
  let nextId = rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;

  return {
    rows,
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params;
          return this;
        },
        async run() {
          if (/^INSERT INTO logs/i.test(sql)) {
            const [user_id, username, avatar, conteudo, impedimento, criado_em] = boundParams;
            const id = nextId++;
            rows.push({ id, user_id, username, avatar, conteudo, impedimento, criado_em });
            return { success: true, meta: { last_row_id: id } };
          }
          throw new Error(`SQL run não suportado no mock: ${sql}`);
        },
        async all() {
          if (/^SELECT .* FROM logs WHERE user_id = \?/i.test(sql)) {
            let idx = 0;
            const userId = boundParams[idx++];
            let filtered = rows.filter((r) => r.user_id === userId);

            if (sql.includes('AND conteudo LIKE ?')) {
              const pattern = String(boundParams[idx++]).replace(/^%|%$/g, '').toLowerCase();
              filtered = filtered.filter((r) => r.conteudo.toLowerCase().includes(pattern));
            }
            if (sql.includes('AND impedimento = ?')) {
              const imp = boundParams[idx++];
              filtered = filtered.filter((r) => r.impedimento === imp);
            }
            if (sql.includes('AND criado_em >= ?')) {
              const inicio = boundParams[idx++];
              filtered = filtered.filter((r) => r.criado_em >= inicio);
            }
            if (sql.includes('AND criado_em <= ?')) {
              const fim = boundParams[idx++];
              filtered = filtered.filter((r) => r.criado_em <= fim);
            }

            filtered.sort((a, b) => {
              if (b.criado_em !== a.criado_em) return b.criado_em.localeCompare(a.criado_em);
              return (b.id || 0) - (a.id || 0);
            });

            return { results: filtered };
          }
          throw new Error(`SQL all não suportado no mock: ${sql}`);
        },
      };
    },
  };
}

function makeEnv(db) {
  return {
    DB: db,
    DISCORD_CLIENT_SECRET: TEST_SECRET,
  };
}

test('signSession e verifySession rejeitam token adulterado', async () => {
  const token = await signSession(
    { user_id: '111', username: 'rafael', avatar: 'abc' },
    TEST_SECRET
  );
  const valid = await verifySession(token, TEST_SECRET);
  assert.equal(valid.user_id, '111');
  assert.equal(valid.username, 'rafael');

  const [payloadPart, sigPart] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ user_id: '999', username: 'invasor', exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');

  const tampered = await verifySession(`${forgedPayload}.${sigPart}`, TEST_SECRET);
  assert.equal(tampered, null);

  const wrongSecret = await verifySession(`${payloadPart}.${sigPart}`, 'outro-segredo');
  assert.equal(wrongSecret, null);
});

test('GET /api/logs e POST /api/logs retornam 401 sem sessão válida', async () => {
  const env = makeEnv(createMockD1());

  const resGet = await getLogs({
    request: new Request('https://example.pages.dev/api/logs'),
    env,
  });
  assert.equal(resGet.status, 401);

  const resPost = await postLogs({
    request: new Request('https://example.pages.dev/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: 'Teste', impedimento: 'sem' }),
    }),
    env,
  });
  assert.equal(resPost.status, 401);
});

test('POST /api/logs valida payload e força timestamp UTC do servidor', async () => {
  const db = createMockD1();
  const env = makeEnv(db);
  const token = await signSession({ user_id: 'user-1', username: 'Rafael' }, TEST_SECRET);
  const cookieHeader = `session=${token}`;

  // Conteúdo só com espaços deve falhar
  const blankRes = await postLogs({
    request: new Request('https://example.pages.dev/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ conteudo: '   ', impedimento: 'sem' }),
    }),
    env,
  });
  assert.equal(blankRes.status, 400);

  // Impedimento inválido deve falhar
  const badImpRes = await postLogs({
    request: new Request('https://example.pages.dev/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ conteudo: 'Teste válido', impedimento: 'invalido' }),
    }),
    env,
  });
  assert.equal(badImpRes.status, 400);

  // Tentativa de adulterar criado_em no cliente deve ser ignorada
  const before = Date.now();
  const okRes = await postLogs({
    request: new Request('https://example.pages.dev/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({
        conteudo: 'Implementei assinatura HMAC no cookie',
        impedimento: 'sem',
        criado_em: '1999-01-01T00:00:00.000Z',
      }),
    }),
    env,
  });
  assert.equal(okRes.status, 201);
  const data = await okRes.json();
  assert.equal(data.success, true);
  assert.match(data.criado_em, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(Date.parse(data.criado_em) >= before - 1000);
  assert.notEqual(data.criado_em, '1999-01-01T00:00:00.000Z');
});

test('GET /api/logs isola registros por user_id e filtra corretamente busca e intervalo de datas', async () => {
  const db = createMockD1([
    {
      id: 1,
      user_id: 'user-1',
      username: 'Rafael',
      avatar: null,
      conteudo: 'Configuração inicial do D1',
      impedimento: 'sem',
      criado_em: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 2,
      user_id: 'user-1',
      username: 'Rafael',
      avatar: null,
      conteudo: 'Bloqueio no OAuth2 do Discord',
      impedimento: 'bloqueado',
      criado_em: '2026-11-12T18:45:00.000Z',
    },
    {
      id: 3,
      user_id: 'user-2',
      username: 'Outro',
      avatar: null,
      conteudo: 'Registro privado de outro usuário',
      impedimento: 'sem',
      criado_em: '2026-11-12T18:45:00.000Z',
    },
  ]);

  const env = makeEnv(db);
  const token = await signSession({ user_id: 'user-1', username: 'Rafael' }, TEST_SECRET);
  const headers = { Cookie: `session=${token}` };

  // Isolamento por usuário + data final inclusiva no dia 2026-11-12
  const resRange = await getLogs({
    request: new Request('https://example.pages.dev/api/logs?inicio=2026-11-12&fim=2026-11-12', {
      headers,
    }),
    env,
  });
  assert.equal(resRange.status, 200);
  const rangeLogs = await resRange.json();
  assert.equal(rangeLogs.length, 1);
  assert.equal(rangeLogs[0].id, 2);

  // Busca textual
  const resBusca = await getLogs({
    request: new Request('https://example.pages.dev/api/logs?busca=D1', { headers }),
    env,
  });
  const buscaLogs = await resBusca.json();
  assert.equal(buscaLogs.length, 1);
  assert.equal(buscaLogs[0].id, 1);
});

test('GET /api/auth/me valida sessão e limpa cookie no logout', async () => {
  const env = makeEnv(createMockD1());
  const token = await signSession({ user_id: 'user-1', username: 'Rafael', avatar: 'av1' }, TEST_SECRET);

  const unauthRes = await getMe({
    request: new Request('https://example.pages.dev/api/auth/me'),
    env,
  });
  assert.equal(unauthRes.status, 401);

  const okRes = await getMe({
    request: new Request('https://example.pages.dev/api/auth/me', {
      headers: { Cookie: `session=${token}` },
    }),
    env,
  });
  assert.equal(okRes.status, 200);
  const user = await okRes.json();
  assert.equal(user.user_id, 'user-1');
  assert.equal(user.username, 'Rafael');

  const logoutRes = await getMe({
    request: new Request('https://example.pages.dev/api/auth/me?logout=1', {
      headers: { Cookie: `session=${token}`, Accept: 'application/json' },
    }),
    env,
  });
  assert.equal(logoutRes.status, 200);
  assert.match(logoutRes.headers.get('Set-Cookie') || '', /Max-Age=0/);
});

test('aliases oficiais /api/auth/discord encaminham para o fluxo canônico preservando a query', async () => {
  const loginRes = await discordLoginAlias({
    request: new Request('https://example.pages.dev/api/auth/discord'),
  });
  assert.equal(loginRes.status, 302);
  assert.equal(loginRes.headers.get('Location'), 'https://example.pages.dev/api/auth/login');

  const callbackRes = await discordCallbackAlias({
    request: new Request('https://example.pages.dev/api/auth/discord/callback?code=abc&state=xyz'),
  });
  assert.equal(callbackRes.status, 302);
  assert.equal(
    callbackRes.headers.get('Location'),
    'https://example.pages.dev/api/auth/callback?code=abc&state=xyz'
  );
});
