// tests/api.test.mjs
// Testes de API do Bookmark Manager (Projeto #42) — Chave P26-2A-567B-6EC5-D24D-9098
// Node 18+, node:test e fetch. Sem dependências.
//
// Uso (servidor local já rodando, seed aplicado):
//   node --test tests/api.test.mjs
//
// Variáveis de ambiente (todas opcionais):
//   QA_BASE_URL         URL da API (padrão http://localhost:8788)
//   QA_SESSION_A        valor do cookie discord_session do usuário A
//                       (padrão: 64 letras "a", criado por tests/seed-qa.sql)
//   QA_SESSION_B        cookie do usuário B, outro usuário (padrão: 64 "b")
//   QA_SESSION_LOGOUT   sessão descartável, só para testar o logout (padrão: 64 "c")
//   QA_SESSION_EXPIRED  sessão já expirada (padrão: 64 "d")
//   QA_ALLOW_REMOTE=1   permite rodar contra uma URL que não é localhost
//
// Os testes criam dados com o prefixo QA<timestamp> e apagam o que criaram no final.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

/* ========================================================================== */
/* Configuração                                                               */
/* ========================================================================== */

const BASE = (process.env.QA_BASE_URL || 'http://localhost:8788').replace(/\/+$/, '');
const SESSION_A = (process.env.QA_SESSION_A || 'a'.repeat(64)).trim();
const SESSION_B = (process.env.QA_SESSION_B || 'b'.repeat(64)).trim();
const SESSION_LOGOUT = (process.env.QA_SESSION_LOGOUT || 'c'.repeat(64)).trim();
const SESSION_EXPIRED = (process.env.QA_SESSION_EXPIRED || 'd'.repeat(64)).trim();

const COOKIE_NAME = 'discord_session';
const STATE_COOKIE_NAME = 'discord_oauth_state';
const RUN = `QA${Date.now().toString(36)}`; // prefixo único desta execução
const NOT_FOUND_ID = 999999999;

const hostname = new URL(BASE).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
if (!isLocal && process.env.QA_ALLOW_REMOTE !== '1') {
  throw new Error(
    `QA_BASE_URL (${BASE}) não é local. Estes testes criam e apagam dados; ` +
      'para rodar mesmo assim defina QA_ALLOW_REMOTE=1.'
  );
}

/* ========================================================================== */
/* Funções auxiliares                                                         */
/* ========================================================================== */

/**
 * Faz uma requisição e devolve { status, headers, text, json }.
 * redirect: 'manual' para poder inspecionar os redirecionamentos do OAuth.
 */
async function call(method, path, { session, cookie, body, rawBody, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  else if (session) h.Cookie = `${COOKIE_NAME}=${session}`;

  let payload;
  if (rawBody !== undefined) {
    payload = rawBody;
    h['Content-Type'] = 'application/json';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
  } catch (err) {
    throw new Error(
      `Não consegui conectar em ${BASE}${path}. O servidor local está rodando? ` +
        `(${(err.cause && err.cause.code) || err.message})`
    );
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

const A = (method, path, opts = {}) => call(method, path, { ...opts, session: SESSION_A });
const B = (method, path, opts = {}) => call(method, path, { ...opts, session: SESSION_B });
const ANON = (method, path, opts = {}) => call(method, path, opts);

function expectStatus(r, status) {
  assert.equal(r.status, status, `esperado HTTP ${status}, veio ${r.status}. Corpo: ${r.text.slice(0, 300)}`);
}

function expectError(r, status) {
  expectStatus(r, status);
  assert.ok(
    r.json && typeof r.json.error === 'string' && r.json.error.length > 0,
    `o corpo deveria ser {"error": "..."}; veio: ${r.text.slice(0, 200)}`
  );
}

/** 403 ou 404 são aceitos para recurso de outro usuário. */
function expectForbiddenOrNotFound(r) {
  assert.ok(
    r.status === 403 || r.status === 404,
    `esperado 403 ou 404, veio ${r.status}. Corpo: ${r.text.slice(0, 300)}`
  );
}

const ids = (r) => r.json.links.map((l) => l.id).sort((x, y) => x - y);
const sorted = (...list) => [...list].sort((x, y) => x - y);
const query = (params) => `?${new URLSearchParams(params).toString()}`;

function setCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

// Coleções criadas pelos testes, para apagar no final.
const createdA = [];
const createdB = [];

async function createCollection(who, name, description) {
  const body = description === undefined ? { name } : { name, description };
  const r = await who('POST', '/api/collections', { body });
  expectStatus(r, 201);
  (who === A ? createdA : createdB).push(r.json.collection.id);
  return r.json.collection;
}

async function createLink(who, payload) {
  const r = await who('POST', '/api/links', { body: payload });
  expectStatus(r, 201);
  return r.json.link;
}

after(async () => {
  for (const id of createdA) await A('DELETE', `/api/collections/${id}`).catch(() => {});
  for (const id of createdB) await B('DELETE', `/api/collections/${id}`).catch(() => {});
});

let userA = null;
let userB = null;

/* ========================================================================== */
/* PRE – pré-requisitos                                                       */
/* ========================================================================== */

describe('PRE – pré-requisitos', () => {
  it('PRE-01 servidor responde e /api/auth/me sem cookie → 401 JSON', async () => {
    const r = await ANON('GET', '/api/auth/me');
    expectError(r, 401);
  });

  it('PRE-02 sessão do usuário A é válida (rode tests/seed-qa.sql ou informe QA_SESSION_A)', async () => {
    const r = await A('GET', '/api/auth/me');
    expectStatus(r, 200);
    assert.equal(typeof r.json.user_id, 'string');
    userA = r.json;
  });

  it('PRE-03 sessão do usuário B é válida e é de OUTRO usuário', async () => {
    const r = await B('GET', '/api/auth/me');
    expectStatus(r, 200);
    userB = r.json;
    assert.ok(userA, 'PRE-02 precisa passar antes');
    assert.notEqual(userB.user_id, userA.user_id, 'A e B precisam ser usuários diferentes');
  });
});

/* ========================================================================== */
/* AUTH – sem login → 401                                                     */
/* ========================================================================== */

describe('AUTH – autenticação e sessão', () => {
  const protectedRoutes = [
    ['AUTH-01', 'GET', '/api/auth/me'],
    ['AUTH-02', 'GET', '/api/collections'],
    ['AUTH-03', 'POST', '/api/collections', { name: 'x' }],
    ['AUTH-04', 'PATCH', '/api/collections/1', { name: 'x' }],
    ['AUTH-05', 'DELETE', '/api/collections/1'],
    ['AUTH-06', 'PATCH', '/api/collections/1/visibility', { is_public: true }],
    ['AUTH-07', 'GET', '/api/links'],
    // Payload inválido E sem login: a resposta tem que ser 401 (autenticação vem antes da validação).
    ['AUTH-08', 'POST', '/api/links', { url: 'javascript:alert(1)', title: '' }],
    ['AUTH-09', 'PATCH', '/api/links/1', { title: 'x' }],
    ['AUTH-10', 'DELETE', '/api/links/1'],
  ];

  for (const [id, method, path, body] of protectedRoutes) {
    it(`${id} ${method} ${path} sem login → 401`, async () => {
      const r = await ANON(method, path, body === undefined ? {} : { body });
      expectError(r, 401);
    });
  }

  it('AUTH-11 cookie com sessão inexistente (64 hex aleatórios) → 401', async () => {
    const r = await call('GET', '/api/collections', { session: randomBytes(32).toString('hex') });
    expectError(r, 401);
  });

  it('AUTH-12 cookie com formato inválido → 401', async () => {
    for (const bad of ['abc', 'x'.repeat(64), "' OR 1=1 --", 'a'.repeat(63), 'a'.repeat(65)]) {
      const r = await call('GET', '/api/collections', { cookie: `${COOKIE_NAME}=${bad}` });
      expectError(r, 401);
    }
  });

  it('AUTH-13 sessão expirada → 401 (usa a sessão "d" do seed)', async () => {
    const r = await call('GET', '/api/auth/me', { session: SESSION_EXPIRED });
    expectError(r, 401);
  });

  it('AUTH-14 logout apaga a sessão e limpa o cookie (usa a sessão "c" do seed)', async () => {
    const before = await call('GET', '/api/auth/me', { session: SESSION_LOGOUT });
    expectStatus(before, 200);

    const out = await call('POST', '/api/auth/logout', { session: SESSION_LOGOUT });
    expectStatus(out, 200);
    assert.equal(out.json.ok, true);
    const cookie = setCookies(out.headers).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    assert.ok(cookie, 'o logout deveria enviar Set-Cookie para discord_session');
    assert.match(cookie, /Max-Age=0/i);

    const after = await call('GET', '/api/auth/me', { session: SESSION_LOGOUT });
    expectStatus(after, 401);

    const stillA = await A('GET', '/api/auth/me');
    expectStatus(stillA, 200); // a sessão principal não foi afetada
  });

  it('AUTH-15 /api/auth/me com sessão válida devolve user_id, username e avatar', async () => {
    const r = await A('GET', '/api/auth/me');
    expectStatus(r, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ['avatar', 'user_id', 'username']);
    assert.match(r.json.avatar, /^https:\/\//);
  });
});

/* ========================================================================== */
/* OAUTH – rotas do Discord (sem chamar o Discord de verdade)                 */
/* ========================================================================== */

describe('OAUTH – rotas /api/auth/discord', () => {
  const oauth = { configured: false, location: '', cookies: [] };

  before(async () => {
    const r = await ANON('GET', '/api/auth/discord');
    oauth.location = r.headers.get('location') || '';
    oauth.cookies = setCookies(r.headers);
    oauth.configured = r.status === 302 && oauth.location.startsWith('https://discord.com/');
  });

  it('OAUTH-01 /api/auth/discord → 302 para o Discord com state, scope identify e cookie do state seguro', async (t) => {
    if (!oauth.configured) {
      return t.skip('DISCORD_CLIENT_ID/SECRET não configurados (.dev.vars); a rota respondeu auth_error=not_configured');
    }
    const url = new URL(oauth.location);
    assert.equal(url.origin + url.pathname, 'https://discord.com/api/oauth2/authorize');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('scope'), 'identify');
    assert.ok(url.searchParams.get('client_id'));
    assert.ok(
      url.searchParams.get('redirect_uri').endsWith('/api/auth/discord/callback'),
      'redirect_uri deve terminar em /api/auth/discord/callback'
    );
    const state = url.searchParams.get('state');
    assert.match(state, /^[0-9a-f]{64}$/);
    assert.ok(!/secret/i.test(oauth.location), 'o segredo nunca pode aparecer na URL');

    const cookie = oauth.cookies.find((c) => c.startsWith(`${STATE_COOKIE_NAME}=`));
    assert.ok(cookie, 'deveria enviar o cookie do state');
    assert.ok(cookie.startsWith(`${STATE_COOKIE_NAME}=${state}`), 'o cookie deve guardar o mesmo state da URL');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\/api\/auth\/discord/i);
  });

  it('OAUTH-02 callback com state inválido → /?auth_error=invalid_state e nenhuma sessão criada', async (t) => {
    if (!oauth.configured) return t.skip('Discord não configurado');
    const r = await call('GET', '/api/auth/discord/callback?code=qualquer&state=errado', {
      cookie: `${STATE_COOKIE_NAME}=outro`,
    });
    expectStatus(r, 302);
    assert.equal(r.headers.get('location'), '/?auth_error=invalid_state');
    const session = setCookies(r.headers).find((c) => c.startsWith(`${COOKIE_NAME}=`) && !/Max-Age=0/i.test(c));
    assert.equal(session, undefined, 'não pode criar cookie de sessão');
  });

  it('OAUTH-03 callback com ?error=access_denied → /?auth_error=access_denied', async () => {
    const r = await ANON('GET', '/api/auth/discord/callback?error=access_denied');
    expectStatus(r, 302);
    assert.equal(r.headers.get('location'), '/?auth_error=access_denied');
  });

  it('OAUTH-04 callback com state válido mas sem code → /?auth_error=missing_code', async (t) => {
    if (!oauth.configured) return t.skip('Discord não configurado');
    const r = await call('GET', '/api/auth/discord/callback?state=abc123', {
      cookie: `${STATE_COOKIE_NAME}=abc123`,
    });
    expectStatus(r, 302);
    assert.equal(r.headers.get('location'), '/?auth_error=missing_code');
  });

  it('OAUTH-05 métodos diferentes de GET nas rotas do Discord → 405', async () => {
    for (const path of ['/api/auth/discord', '/api/auth/discord/callback']) {
      const r = await ANON('POST', path);
      expectError(r, 405);
    }
  });
});

/* ========================================================================== */
/* COL – coleções                                                             */
/* ========================================================================== */

describe('COL – coleções', () => {
  let col;
  let other;

  it('COL-01 criar coleção → 201 com o formato esperado', async () => {
    col = await createCollection(A, `${RUN} Compiladores`, 'Trilha de estudos');
    assert.equal(typeof col.id, 'number');
    assert.equal(col.name, `${RUN} Compiladores`);
    assert.equal(col.description, 'Trilha de estudos');
    assert.equal(col.is_public, false);
    assert.equal(col.public_slug, null);
    assert.equal(col.link_count, 0);
    assert.ok(!('user_id' in col));
  });

  const invalidCreates = [
    ['COL-02', 'nome vazio', { name: '' }],
    ['COL-03', 'nome só com espaços', { name: '    ' }],
    ['COL-04', 'nome com 81 caracteres', { name: 'n'.repeat(81) }],
    ['COL-05', 'nome que não é texto', { name: 12345 }],
    ['COL-06', 'nome ausente', {}],
    ['COL-07', 'descrição com 501 caracteres', { name: `${RUN} desc longa`, description: 'd'.repeat(501) }],
  ];
  for (const [id, label, body] of invalidCreates) {
    it(`${id} criar coleção com ${label} → 400`, async () => {
      const r = await A('POST', '/api/collections', { body });
      expectError(r, 400);
    });
  }

  it('COL-08 nome duplicado para o mesmo usuário → 409', async () => {
    const r = await A('POST', '/api/collections', { body: { name: `${RUN} Compiladores` } });
    expectError(r, 409);
  });

  it('COL-09 listar devolve a coleção criada com link_count', async () => {
    const r = await A('GET', '/api/collections');
    expectStatus(r, 200);
    const found = r.json.collections.find((c) => c.id === col.id);
    assert.ok(found, 'a coleção criada deveria aparecer na lista');
    assert.equal(found.link_count, 0);
  });

  it('COL-10 renomear e alterar a descrição → 200', async () => {
    const r = await A('PATCH', `/api/collections/${col.id}`, {
      body: { name: `${RUN} Compiladores 2`, description: 'Nova descrição' },
    });
    expectStatus(r, 200);
    assert.equal(r.json.collection.name, `${RUN} Compiladores 2`);
    assert.equal(r.json.collection.description, 'Nova descrição');
  });

  it('COL-11 renomear para um nome que já existe → 409', async () => {
    other = await createCollection(A, `${RUN} Outra`);
    const r = await A('PATCH', `/api/collections/${other.id}`, { body: { name: `${RUN} Compiladores 2` } });
    expectError(r, 409);
  });

  it('COL-12 PATCH sem nenhum campo → 400', async () => {
    const r = await A('PATCH', `/api/collections/${col.id}`, { body: {} });
    expectError(r, 400);
  });

  it('COL-13 id inválido (abc, 0, -1) → 400', async () => {
    for (const bad of ['abc', '0', '-1']) {
      const r = await A('PATCH', `/api/collections/${bad}`, { body: { name: 'x' } });
      expectError(r, 400);
    }
  });

  it('COL-14 PATCH em coleção inexistente → 404', async () => {
    const r = await A('PATCH', `/api/collections/${NOT_FOUND_ID}`, { body: { name: `${RUN} fantasma` } });
    expectError(r, 404);
  });

  it('COL-15 excluir a coleção apaga também os links dela', async () => {
    const c = await createCollection(A, `${RUN} Para excluir`);
    const link = await createLink(A, { collection_id: c.id, url: 'https://example.com/del', title: 'Será apagado' });

    const del = await A('DELETE', `/api/collections/${c.id}`);
    expectStatus(del, 200);
    assert.equal(del.json.ok, true);

    const all = await A('GET', '/api/links');
    expectStatus(all, 200);
    assert.ok(!ids(all).includes(link.id), 'o link deveria ter sido apagado junto');

    const byCollection = await A('GET', `/api/links?collection_id=${c.id}`);
    expectError(byCollection, 404);
  });

  it('COL-16 excluir coleção inexistente → 404', async () => {
    const r = await A('DELETE', `/api/collections/${NOT_FOUND_ID}`);
    expectError(r, 404);
  });
});

/* ========================================================================== */
/* VAL – validação de entrada ao criar link                                   */
/* ========================================================================== */

describe('VAL – validação de entrada (POST /api/links)', () => {
  let col;
  let validBase;
  let lastError = null;

  before(async () => {
    col = await createCollection(A, `${RUN} Validação`);
    validBase = {
      collection_id: col.id,
      url: 'https://example.com/ok',
      title: 'Título válido',
      summary: '',
      status: 'Para Ler',
    };
  });

  // Valor undefined é descartado pelo JSON.stringify, o que simula "campo ausente".
  const cases = [
    ['VAL-01', 'URL javascript:', { url: 'javascript:alert(1)' }, 400],
    ['VAL-02', 'URL ftp:', { url: 'ftp://example.com/arquivo' }, 400],
    ['VAL-03', 'URL data:', { url: 'data:text/html,<script>alert(1)</script>' }, 400],
    ['VAL-04', 'texto que não é URL', { url: 'isso nao e uma url' }, 400],
    ['VAL-05', 'URL vazia', { url: '' }, 400],
    ['VAL-06', 'URL com mais de 2048 caracteres', { url: `https://example.com/${'a'.repeat(2100)}` }, 400],
    ['VAL-07', 'título vazio', { title: '' }, 400],
    ['VAL-08', 'título só com espaços', { title: '    ' }, 400],
    ['VAL-09', 'título com 201 caracteres', { title: 't'.repeat(201) }, 400],
    ['VAL-10', 'resumo com 1001 caracteres', { summary: 's'.repeat(1001) }, 400],
    ['VAL-11', 'status fora dos 3 permitidos ("Done")', { status: 'Done' }, 400],
    ['VAL-12', 'status em minúsculas ("para ler")', { status: 'para ler' }, 400],
    ['VAL-13', 'status que não é texto', { status: 1 }, 400],
    ['VAL-14', 'collection_id ausente', { collection_id: undefined }, 400],
    ['VAL-15', 'collection_id inválido ("abc")', { collection_id: 'abc' }, 400],
    ['VAL-16', 'collection_id inexistente', { collection_id: NOT_FOUND_ID }, 404],
    ['VAL-22', 'título ausente', { title: undefined }, 400],
    ['VAL-23', 'URL ausente', { url: undefined }, 400],
    ['VAL-24', 'URL JaVaScRiPt: (maiúsculas e minúsculas)', { url: 'JaVaScRiPt:alert(1)' }, 400],
    ['VAL-25', 'URL file:', { url: 'file:///etc/passwd' }, 400],
  ];

  for (const [id, label, patch, expected] of cases) {
    it(`${id} criar link com ${label} → ${expected}`, async () => {
      const r = await A('POST', '/api/links', { body: { ...validBase, ...patch } });
      expectError(r, expected);
      lastError = r;
    });
  }

  it('VAL-17 JSON inválido → 400', async () => {
    const r = await A('POST', '/api/links', { rawBody: '{isso nao e json' });
    expectError(r, 400);
  });

  it('VAL-18 corpo que é um array (e não objeto) → 400', async () => {
    const r = await A('POST', '/api/links', { rawBody: '[1,2,3]' });
    expectError(r, 400);
  });

  it('VAL-19 corpo maior que 16 KB → 413', async () => {
    const r = await A('POST', '/api/collections', { rawBody: JSON.stringify({ name: 'x', description: 'a'.repeat(20000) }) });
    expectError(r, 413);
  });

  it('VAL-20 nenhum dos casos inválidos acima criou link no banco', async () => {
    const r = await A('GET', `/api/links?collection_id=${col.id}`);
    expectStatus(r, 200);
    assert.equal(r.json.links.length, 0, 'a coleção de validação deveria continuar vazia');
  });

  it('VAL-21 respostas de erro só têm a chave "error" (sem stack trace)', async () => {
    assert.ok(lastError, 'nenhum erro capturado');
    assert.deepEqual(Object.keys(lastError.json), ['error']);
    const bad = await A('POST', '/api/links', { rawBody: '{quebrado' });
    assert.deepEqual(Object.keys(bad.json), ['error']);
    assert.ok(!/\bat\s+\S+\s*\(|stack|\.js:\d+/i.test(bad.text), 'a resposta parece conter stack trace');
  });
});

/* ========================================================================== */
/* LNK – CRUD de links                                                        */
/* ========================================================================== */

describe('LNK – CRUD de links', () => {
  let c1;
  let c2;
  let base;

  before(async () => {
    c1 = await createCollection(A, `${RUN} CRUD 1`);
    c2 = await createCollection(A, `${RUN} CRUD 2`);
  });

  it('LNK-01 criar link mínimo → 201, status padrão "Para Ler", sem user_id', async () => {
    const r = await A('POST', '/api/links', {
      body: { collection_id: c1.id, url: 'https://example.com/a', title: 'Primeiro' },
    });
    expectStatus(r, 201);
    const link = r.json.link;
    assert.equal(typeof link.id, 'number');
    assert.equal(link.collection_id, c1.id);
    assert.equal(link.url, 'https://example.com/a');
    assert.equal(link.title, 'Primeiro');
    assert.equal(link.summary, '');
    assert.equal(link.status, 'Para Ler');
    assert.ok(link.created_at && link.updated_at);
    assert.ok(!('user_id' in link));
    base = link;
  });

  it('LNK-02 user_id enviado no corpo é ignorado', async () => {
    const r = await A('POST', '/api/links', {
      body: { collection_id: c1.id, url: 'https://example.com/b', title: 'user_id forjado', user_id: '123456789' },
    });
    expectStatus(r, 201);
    assert.ok(!('user_id' in r.json.link));
    const list = await A('GET', `/api/links?collection_id=${c1.id}`);
    assert.ok(ids(list).includes(r.json.link.id), 'o link deve pertencer ao usuário da sessão');
  });

  it('LNK-03 criar links com os 3 status, inclusive "Concluído" com acento', async () => {
    for (const status of ['Para Ler', 'Lendo', 'Concluído']) {
      const r = await A('POST', '/api/links', {
        body: { collection_id: c1.id, url: 'https://example.com/s', title: `Status ${status}`, status },
      });
      expectStatus(r, 201);
      assert.equal(r.json.link.status, status);
    }
  });

  it('LNK-04 listar a coleção devolve os 5 links criados até aqui', async () => {
    const r = await A('GET', `/api/links?collection_id=${c1.id}`);
    expectStatus(r, 200);
    assert.equal(r.json.links.length, 5);
    assert.ok(ids(r).includes(base.id));
  });

  it('LNK-05 PATCH altera título e status', async () => {
    const r = await A('PATCH', `/api/links/${base.id}`, { body: { title: 'Primeiro (editado)', status: 'Lendo' } });
    expectStatus(r, 200);
    assert.equal(r.json.link.title, 'Primeiro (editado)');
    assert.equal(r.json.link.status, 'Lendo');
    assert.equal(r.json.link.collection_id, c1.id);
  });

  it('LNK-06 PATCH com resumo vazio apaga o resumo', async () => {
    const created = await createLink(A, {
      collection_id: c1.id,
      url: 'https://example.com/r',
      title: 'Com resumo',
      summary: 'texto do resumo',
    });
    assert.equal(created.summary, 'texto do resumo');
    const r = await A('PATCH', `/api/links/${created.id}`, { body: { summary: '' } });
    expectStatus(r, 200);
    assert.equal(r.json.link.summary, '');
  });

  it('LNK-07 PATCH com URL inválida → 400 e o link não muda', async () => {
    const r = await A('PATCH', `/api/links/${base.id}`, { body: { url: 'javascript:alert(1)' } });
    expectError(r, 400);
    const list = await A('GET', `/api/links?collection_id=${c1.id}`);
    const found = list.json.links.find((l) => l.id === base.id);
    assert.equal(found.url, 'https://example.com/a');
  });

  it('LNK-08 PATCH sem nenhum campo → 400', async () => {
    const r = await A('PATCH', `/api/links/${base.id}`, { body: {} });
    expectError(r, 400);
  });

  it('LNK-09 PATCH em link inexistente → 404', async () => {
    const r = await A('PATCH', `/api/links/${NOT_FOUND_ID}`, { body: { title: 'x' } });
    expectError(r, 404);
  });

  it('LNK-10 mover o link para outra coleção do próprio usuário → 200', async () => {
    const r = await A('PATCH', `/api/links/${base.id}`, { body: { collection_id: c2.id } });
    expectStatus(r, 200);
    assert.equal(r.json.link.collection_id, c2.id);
    const inC2 = await A('GET', `/api/links?collection_id=${c2.id}`);
    const inC1 = await A('GET', `/api/links?collection_id=${c1.id}`);
    assert.ok(ids(inC2).includes(base.id));
    assert.ok(!ids(inC1).includes(base.id));
  });

  it('LNK-11 mover para coleção inexistente → 404 e o link continua onde estava', async () => {
    const r = await A('PATCH', `/api/links/${base.id}`, { body: { collection_id: NOT_FOUND_ID } });
    expectError(r, 404);
    const inC2 = await A('GET', `/api/links?collection_id=${c2.id}`);
    assert.ok(ids(inC2).includes(base.id));
  });

  it('LNK-12 DELETE do link → 200 e ele some da listagem', async () => {
    const r = await A('DELETE', `/api/links/${base.id}`);
    expectStatus(r, 200);
    assert.equal(r.json.ok, true);
    const all = await A('GET', '/api/links');
    assert.ok(!ids(all).includes(base.id));
  });

  it('LNK-13 DELETE repetido no mesmo link → 404', async () => {
    const r = await A('DELETE', `/api/links/${base.id}`);
    expectError(r, 404);
  });

  it('LNK-14 PUT em /api/links/:id → 405', async () => {
    const r = await A('PUT', `/api/links/${base.id}`, { body: { title: 'x' } });
    expectError(r, 405);
  });

  it('LNK-15 id inválido em PATCH e DELETE → 400', async () => {
    const p = await A('PATCH', '/api/links/abc', { body: { title: 'x' } });
    expectError(p, 400);
    const d = await A('DELETE', '/api/links/abc');
    expectError(d, 400);
  });

  it('LNK-16 "Concluído" enviado em forma decomposta (NFD) é aceito e gravado normalizado', async () => {
    const nfd = 'Concluído'.normalize('NFD');
    const r = await A('POST', '/api/links', {
      body: { collection_id: c1.id, url: 'https://example.com/nfd', title: 'NFD', status: nfd },
    });
    expectStatus(r, 201);
    assert.equal(r.json.link.status, 'Concluído'.normalize('NFC'));
  });
});

/* ========================================================================== */
/* FLT – filtro combinado coleção + status                                    */
/* ========================================================================== */

describe('FLT – filtro combinado coleção + status', () => {
  let c1;
  let c2;
  const L = {};

  before(async () => {
    c1 = await createCollection(A, `${RUN} Filtro 1`);
    c2 = await createCollection(A, `${RUN} Filtro 2`);
    const mk = async (key, col, status) => {
      L[key] = await createLink(A, {
        collection_id: col.id,
        url: `https://example.com/${key}`,
        title: `Link ${key}`,
        status,
      });
    };
    await mk('f1', c1, 'Para Ler');
    await mk('f2', c1, 'Lendo');
    await mk('f3', c1, 'Lendo');
    await mk('f4', c1, 'Concluído');
    await mk('f5', c2, 'Lendo');
    await mk('f6', c2, 'Concluído');
  });

  it('FLT-01 só coleção: C1 → f1, f2, f3, f4', async () => {
    const r = await A('GET', `/api/links${query({ collection_id: c1.id })}`);
    expectStatus(r, 200);
    assert.deepEqual(ids(r), sorted(L.f1.id, L.f2.id, L.f3.id, L.f4.id));
  });

  it('FLT-02 só status: "Lendo" traz f2, f3, f5 e nenhum outro status', async () => {
    const r = await A('GET', `/api/links${query({ status: 'Lendo' })}`);
    expectStatus(r, 200);
    const got = ids(r);
    for (const key of ['f2', 'f3', 'f5']) assert.ok(got.includes(L[key].id), `${key} deveria aparecer`);
    for (const key of ['f1', 'f4', 'f6']) assert.ok(!got.includes(L[key].id), `${key} não deveria aparecer`);
    assert.ok(r.json.links.every((l) => l.status === 'Lendo'));
  });

  it('FLT-03 combinado: C1 + Lendo → exatamente f2 e f3', async () => {
    const r = await A('GET', `/api/links${query({ collection_id: c1.id, status: 'Lendo' })}`);
    expectStatus(r, 200);
    assert.deepEqual(ids(r), sorted(L.f2.id, L.f3.id));
  });

  it('FLT-04 combinado: C2 + Concluído → exatamente f6', async () => {
    const r = await A('GET', `/api/links${query({ collection_id: c2.id, status: 'Concluído' })}`);
    expectStatus(r, 200);
    assert.deepEqual(ids(r), [L.f6.id]);
  });

  it('FLT-05 combinado sem resultado: C2 + Para Ler → lista vazia', async () => {
    const r = await A('GET', `/api/links${query({ collection_id: c2.id, status: 'Para Ler' })}`);
    expectStatus(r, 200);
    assert.deepEqual(r.json.links, []);
  });

  it('FLT-06 parâmetros vazios (?collection_id=&status=) = sem filtro → 200 com tudo', async () => {
    const r = await A('GET', '/api/links?collection_id=&status=');
    expectStatus(r, 200);
    const got = ids(r);
    for (const key of Object.keys(L)) assert.ok(got.includes(L[key].id), `${key} deveria aparecer`);
  });

  it('FLT-07 status inválido → 400', async () => {
    const r = await A('GET', `/api/links${query({ status: 'Terminado' })}`);
    expectError(r, 400);
  });

  it('FLT-08 collection_id inválido → 400', async () => {
    for (const bad of ['abc', '0', '-5', '1.5']) {
      const r = await A('GET', `/api/links${query({ collection_id: bad })}`);
      expectError(r, 400);
    }
  });

  it('FLT-09 collection_id inexistente → 404', async () => {
    const r = await A('GET', `/api/links${query({ collection_id: NOT_FOUND_ID })}`);
    expectError(r, 404);
  });
});

/* ========================================================================== */
/* ISO – isolamento entre usuários                                            */
/* ========================================================================== */

describe('ISO – dados de OUTRO usuário (A tenta mexer no que é de B)', () => {
  let colA;
  let linkA;
  let colB;
  let linkB;

  before(async () => {
    colA = await createCollection(A, `${RUN} Iso A`);
    linkA = await createLink(A, { collection_id: colA.id, url: 'https://example.com/iso-a', title: 'Link do A' });
    colB = await createCollection(B, `${RUN} Iso B`);
    linkB = await createLink(B, { collection_id: colB.id, url: 'https://example.com/iso-b', title: 'Link do B' });
  });

  it('ISO-01 as listagens de A não mostram nada de B (e vice-versa)', async () => {
    const colsA = await A('GET', '/api/collections');
    assert.ok(!colsA.json.collections.some((c) => c.id === colB.id), 'A não pode ver coleção de B');
    const linksA = await A('GET', '/api/links');
    assert.ok(!ids(linksA).includes(linkB.id), 'A não pode ver link de B');

    const colsB = await B('GET', '/api/collections');
    assert.ok(!colsB.json.collections.some((c) => c.id === colA.id), 'B não pode ver coleção de A');
    const linksB = await B('GET', '/api/links');
    assert.ok(!ids(linksB).includes(linkA.id), 'B não pode ver link de A');
  });

  it('ISO-02 A renomeia coleção de B → 403/404', async () => {
    const r = await A('PATCH', `/api/collections/${colB.id}`, { body: { name: `${RUN} invadida` } });
    expectForbiddenOrNotFound(r);
  });

  it('ISO-03 A exclui coleção de B → 403/404', async () => {
    const r = await A('DELETE', `/api/collections/${colB.id}`);
    expectForbiddenOrNotFound(r);
  });

  it('ISO-04 A publica coleção de B → 403/404', async () => {
    const r = await A('PATCH', `/api/collections/${colB.id}/visibility`, { body: { is_public: true } });
    expectForbiddenOrNotFound(r);
  });

  it('ISO-05 A lista links filtrando pela coleção de B → 403/404', async () => {
    const r = await A('GET', `/api/links${query({ collection_id: colB.id })}`);
    expectForbiddenOrNotFound(r);
  });

  it('ISO-06 A cria link dentro da coleção de B → 403/404', async () => {
    const r = await A('POST', '/api/links', {
      body: { collection_id: colB.id, url: 'https://example.com/invasao', title: 'Invasão' },
    });
    expectForbiddenOrNotFound(r);
  });

  it('ISO-07 A altera link de B → 403/404', async () => {
    const r = await A('PATCH', `/api/links/${linkB.id}`, { body: { title: 'hackeado' } });
    expectForbiddenOrNotFound(r);
  });

  it('ISO-08 A exclui link de B → 403/404', async () => {
    const r = await A('DELETE', `/api/links/${linkB.id}`);
    expectForbiddenOrNotFound(r);
  });

  it('ISO-09 A move o PRÓPRIO link para a coleção de B → 403/404 e o link fica onde estava', async () => {
    const r = await A('PATCH', `/api/links/${linkA.id}`, { body: { collection_id: colB.id } });
    expectForbiddenOrNotFound(r);
    const list = await A('GET', `/api/links${query({ collection_id: colA.id })}`);
    assert.ok(ids(list).includes(linkA.id));
  });

  it('ISO-10 depois de todas as tentativas, os dados de B continuam intactos', async () => {
    const cols = await B('GET', '/api/collections');
    const found = cols.json.collections.find((c) => c.id === colB.id);
    assert.ok(found, 'a coleção de B deveria existir');
    assert.equal(found.name, `${RUN} Iso B`);
    assert.equal(found.is_public, false);
    assert.equal(found.public_slug, null);
    assert.equal(found.link_count, 1);

    const links = await B('GET', `/api/links${query({ collection_id: colB.id })}`);
    assert.equal(links.json.links.length, 1);
    assert.equal(links.json.links[0].title, 'Link do B');
  });
});

/* ========================================================================== */
/* PUB – coleção pública                                                      */
/* ========================================================================== */

describe('PUB – coleção pública (/api/public/:slug)', () => {
  let col;
  let slug1;
  let slug2;
  const created = [];
  const SLUG_FORMAT = /^[A-Za-z0-9_-]{16,64}$/;

  before(async () => {
    col = await createCollection(A, `${RUN} Trilha Compiladores`, 'Melhores artigos sobre Compiladores');
    for (const [title, status] of [
      ['P1 Lendo', 'Lendo'],
      ['P2 Para Ler', 'Para Ler'],
      ['P3 Concluído', 'Concluído'],
    ]) {
      created.push(
        await createLink(A, {
          collection_id: col.id,
          url: `https://example.com/${encodeURIComponent(title)}`,
          title,
          summary: `Resumo de ${title}`,
          status,
        })
      );
    }
  });

  it('PUB-01 slug com formato válido mas inexistente → 404 (sem login)', async () => {
    const r = await ANON('GET', `/api/public/${'A'.repeat(22)}`);
    expectError(r, 404);
  });

  it('PUB-02 slugs com formato inválido → 404', async () => {
    for (const bad of ['abc', 'a'.repeat(65), encodeURIComponent('com espaco aqui 1234'), encodeURIComponent('<script>alert(1)</script>')]) {
      const r = await ANON('GET', `/api/public/${bad}`);
      expectError(r, 404);
    }
  });

  it('PUB-03 coleção privada não tem slug e não é acessível por id nem por nome → 404', async () => {
    assert.equal(col.is_public, false);
    assert.equal(col.public_slug, null);
    const byId = await ANON('GET', `/api/public/${col.id}`);
    expectError(byId, 404);
    const byName = await ANON('GET', `/api/public/${encodeURIComponent(col.name)}`);
    expectError(byName, 404);
  });

  it('PUB-04 publicar → 200, is_public true e public_slug no formato esperado', async () => {
    const r = await A('PATCH', `/api/collections/${col.id}/visibility`, { body: { is_public: true } });
    expectStatus(r, 200);
    assert.equal(r.json.collection.is_public, true);
    assert.match(r.json.collection.public_slug, SLUG_FORMAT);
    slug1 = r.json.collection.public_slug;
  });

  it('PUB-05 publicar de novo mantém o mesmo slug', async () => {
    const r = await A('PATCH', `/api/collections/${col.id}/visibility`, { body: { is_public: true } });
    expectStatus(r, 200);
    assert.equal(r.json.collection.public_slug, slug1);
  });

  it('PUB-06 coleção pública → 200 SEM login, JSON, no-store', async (t) => {
    const r = await ANON('GET', `/api/public/${slug1}`);
    expectStatus(r, 200);
    assert.match(r.headers.get('content-type') || '', /application\/json/i);
    assert.match(r.headers.get('cache-control') || '', /no-store/i);
    assert.equal(r.json.collection.name, `${RUN} Trilha Compiladores`);
    assert.equal(r.json.collection.description, 'Melhores artigos sobre Compiladores');
    assert.equal(typeof r.json.collection.owner.username, 'string');
    assert.match(r.json.collection.owner.avatar, /^https:\/\//);
    assert.equal(r.json.links.length, 3);

    const avatar = r.json.collection.owner.avatar;
    if (userA && avatar.includes(userA.user_id)) {
      t.diagnostic('AVISO (achado SEC-02): a URL do avatar público contém o Discord ID do dono.');
    }
  });

  it('PUB-07 a resposta pública expõe somente o contrato esperado (nunca user_id nem ids internos)', async () => {
    const r = await ANON('GET', `/api/public/${slug1}`);
    expectStatus(r, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ['collection', 'links']);
    assert.deepEqual(Object.keys(r.json.collection).sort(), ['description', 'name', 'owner']);
    assert.deepEqual(Object.keys(r.json.collection.owner).sort(), ['avatar', 'username']);
    for (const link of r.json.links) {
      assert.deepEqual(Object.keys(link).sort(), ['status', 'summary', 'title', 'url']);
    }
    assert.ok(!/"user_id"/.test(r.text), 'a chave user_id não pode aparecer na resposta pública');
  });

  it('PUB-08 os links vêm na ordem de inclusão', async () => {
    const r = await ANON('GET', `/api/public/${slug1}`);
    assert.deepEqual(
      r.json.links.map((l) => l.title),
      ['P1 Lendo', 'P2 Para Ler', 'P3 Concluído']
    );
  });

  it('PUB-09 rota pública é somente leitura: POST/PUT/PATCH/DELETE → 405', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const r = await ANON(method, `/api/public/${slug1}`, { body: {} });
      expectError(r, 405);
    }
  });

  it('PUB-10 is_public com valor inválido ou ausente → 400', async () => {
    for (const body of [{ is_public: 'sim' }, { is_public: null }, { is_public: 2 }, {}]) {
      const r = await A('PATCH', `/api/collections/${col.id}/visibility`, { body });
      expectError(r, 400);
    }
    const still = await ANON('GET', `/api/public/${slug1}`);
    expectStatus(still, 200); // as tentativas inválidas não despublicaram
  });

  it('PUB-11 despublicar → is_public false, slug null e o link antigo passa a dar 404', async () => {
    const r = await A('PATCH', `/api/collections/${col.id}/visibility`, { body: { is_public: false } });
    expectStatus(r, 200);
    assert.equal(r.json.collection.is_public, false);
    assert.equal(r.json.collection.public_slug, null);
    const old = await ANON('GET', `/api/public/${slug1}`);
    expectError(old, 404);
  });

  it('PUB-12 republicar gera um slug NOVO e o antigo continua 404', async () => {
    const r = await A('PATCH', `/api/collections/${col.id}/visibility`, { body: { is_public: true } });
    expectStatus(r, 200);
    slug2 = r.json.collection.public_slug;
    assert.match(slug2, SLUG_FORMAT);
    assert.notEqual(slug2, slug1);
    expectError(await ANON('GET', `/api/public/${slug1}`), 404);
    expectStatus(await ANON('GET', `/api/public/${slug2}`), 200);
  });

  it('PUB-13 excluir a coleção pública faz o link dela dar 404', async () => {
    const del = await A('DELETE', `/api/collections/${col.id}`);
    expectStatus(del, 200);
    expectError(await ANON('GET', `/api/public/${slug2}`), 404);
  });
});

/* ========================================================================== */
/* XSS – dados com HTML são guardados e devolvidos como texto                 */
/* ========================================================================== */

describe('XSS – conteúdo com HTML na API', () => {
  it('XSS-01 <script> e <img onerror> são guardados literalmente e servidos como JSON (a execução é testada no checklist manual)', async () => {
    const name = `${RUN} <img src=x onerror=alert(1)>`;
    const title = "<script>alert('xss')</script>";
    const summary = '<b>negrito</b> & "aspas"';

    const col = await createCollection(A, name, '<script>alert(2)</script>');
    assert.equal(col.name, name);
    const link = await createLink(A, { collection_id: col.id, url: 'https://example.com/xss', title, summary });
    assert.equal(link.title, title);
    assert.equal(link.summary, summary);

    const pub = await A('PATCH', `/api/collections/${col.id}/visibility`, { body: { is_public: true } });
    expectStatus(pub, 200);
    const r = await ANON('GET', `/api/public/${pub.json.collection.public_slug}`);
    expectStatus(r, 200);
    assert.match(r.headers.get('content-type') || '', /application\/json/i, 'nunca text/html');
    assert.equal(r.json.collection.name, name);
    assert.equal(r.json.links[0].title, title);
    assert.equal(r.json.links[0].summary, summary);
  });
});

/* ========================================================================== */
/* HTTP – métodos e formato das respostas                                     */
/* ========================================================================== */

describe('HTTP – métodos não suportados e respostas de erro', () => {
  const wrongMethods = [
    ['DELETE', '/api/collections'],
    ['PUT', '/api/collections/1'],
    ['GET', '/api/collections/1'],
    ['POST', '/api/collections/1/visibility'],
    ['PUT', '/api/links'],
    ['GET', '/api/links/1'],
    ['POST', '/api/public/xxxxxxxxxxxxxxxxxxxxxx'],
    ['GET', '/api/auth/logout'],
    ['POST', '/api/auth/me'],
  ];

  it('HTTP-01 método não suportado → 405 com cabeçalho Allow (e antes de qualquer 401)', async () => {
    for (const [method, path] of wrongMethods) {
      const r = await ANON(method, path, method === "GET" ? {} : { body: {} });
      assert.equal(r.status, 405, `${method} ${path} deveria ser 405, veio ${r.status}`);
      assert.ok(r.headers.get('allow'), `${method} ${path} deveria enviar Allow`);
    }
  });

  it('HTTP-02 respostas 400, 401, 404 e 405 são JSON {"error": "..."}', async () => {
    const samples = [
      await A('POST', '/api/collections', { body: { name: '' } }),
      await ANON('GET', '/api/collections'),
      await A('PATCH', `/api/collections/${NOT_FOUND_ID}`, { body: { name: 'x' } }),
      await A('DELETE', '/api/collections'),
    ];
    for (const r of samples) {
      assert.match(r.headers.get('content-type') || '', /application\/json/i);
      assert.ok(r.json && typeof r.json.error === 'string');
    }
    assert.deepEqual(samples.map((r) => r.status), [400, 401, 404, 405]);
  });
});
