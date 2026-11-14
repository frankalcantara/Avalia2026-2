import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://entrelivros.example';
const actorIds = {alice: '111111111111111111', bob: '222222222222222222', carol: '333333333333333333'};
const tokens = Object.fromEntries(Object.keys(actorIds).map(actor => [actor, randomBytes(32).toString('hex')]));
const hash = value => createHash('sha256').update(value).digest('hex');
const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
let mf;
let db;
let oauthScenario = null;
let oauthCalls = [];

before(async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('./worker.mjs', import.meta.url))], bundle: true, format: 'esm', platform: 'browser', write: false });
  // Wrangler 4.162 uses Miniflare 5 beta; its official adapter preserves v4 options.
  mf = new Miniflare(await convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-11-13',
    d1Databases: {DB: 'test-entrelivros-isolated'},
    bindings: {DISCORD_CLIENT_ID: '444444444444444444', DISCORD_CLIENT_SECRET: 'test-only-not-a-real-secret'},
    outboundService: async incoming => {
      const url = new URL(incoming.url);
      if (!oauthScenario || url.origin !== 'https://discord.com') throw new Error('Rede externa bloqueada durante os testes.');
      oauthCalls.push({url: incoming.url, method: incoming.method, body: await incoming.text(), authorization: incoming.headers.get('Authorization')});
      if (url.pathname === '/api/oauth2/token') return Response.json({access_token: 'test-discord-access-token'}, {status: oauthScenario.tokenStatus || 200});
      if (url.pathname === '/api/v10/users/@me') return Response.json({id: '555555555555555555', username: 'discord.handle', global_name: 'Nome do Discord', avatar: 'a'.repeat(32)});
      throw new Error('URL Discord inesperada no teste.');
    },
  }));
  db = await mf.getD1Database('DB');
  for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    // D1 exec treats newline as a statement separator; one line preserves compound triggers.
    await db.exec(sql.replace(/--[^\n\r]*/g, '').replace(/\r?\n/g, ' '));
  }
  for (const [actor, userId] of Object.entries(actorIds)) {
    await db.prepare('INSERT INTO users(user_id,username,display_name,avatar) VALUES (?,?,?,?)')
      .bind(userId, `${actor}.teste`, `Pessoa ${actor}`, 'https://cdn.discordapp.com/embed/avatars/0.png').run();
    await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
      .bind(hash(tokens[actor]), userId, Math.floor(Date.now() / 1000) + 3600).run();
  }
});

after(async () => { await mf?.dispose(); });

async function call(path, {method = 'GET', actor, body, headers = {}} = {}) {
  const requestHeaders = new Headers(headers);
  if (actor) requestHeaders.set('Cookie', `el_session=${tokens[actor]}`);
  if (!['GET', 'HEAD'].includes(method) && !requestHeaders.has('Origin')) requestHeaders.set('Origin', origin);
  if (body !== undefined && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
  const response = await mf.dispatchFetch(origin + path, {
    method, headers: requestHeaders, redirect: 'manual',
    ...(body !== undefined ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {}),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return {status: response.status, headers: response.headers, data};
}

function expectStatus(result, status) {
  assert.equal(result.status, status, JSON.stringify(result.data));
  return result.data;
}

function forbidden(result, codes = [403, 404]) {
  assert.ok(codes.includes(result.status), `Expected ${codes.join('/')} but got ${result.status}: ${JSON.stringify(result.data)}`);
  assert.equal(typeof result.data.error, 'string');
}

async function book(actor = 'alice', overrides = {}) {
  return expectStatus(await call('/api/books', {method: 'POST', actor, body: {
    title: 'Algoritmos na universidade', author: 'Autor de teste', category: 'tecnico',
    condition: 'bom', description: 'Exemplar reservado para testes automatizados.', mode: 'ambos', ...overrides,
  }}), 201).book;
}

async function request(bookId, actor = 'bob', overrides = {}) {
  return expectStatus(await call('/api/requests', {method: 'POST', actor, body: {
    book_id: bookId, type: 'emprestimo', message: 'Podemos combinar a entrega na biblioteca?', ...overrides,
  }}), 201).request;
}

async function action(id, actionName, actor = 'alice', extra = {}) {
  return call(`/api/requests/${id}`, {method: 'PATCH', actor, body: {action: actionName, ...extra}});
}

async function storedBook(id) { return db.prepare('SELECT * FROM books WHERE id = ?').bind(id).first(); }

test('catálogo é público e identidade anônima não é um perfil de demonstração', async () => {
  assert.deepEqual(expectStatus(await call('/api/me'), 200), {user: null});
  assert.ok(Array.isArray(expectStatus(await call('/api/books'), 200).books));
});

test('sessão válida importa user_id, handle, nome visível e avatar', async () => {
  const {user} = expectStatus(await call('/api/me', {actor: 'alice'}), 200);
  assert.equal(user.user_id, actorIds.alice);
  assert.equal(user.username, 'alice.teste');
  assert.equal(user.display_name, 'Pessoa alice');
  assert.match(user.avatar, /^https:\/\/cdn\.discordapp\.com\//);
});

test('cookies falsificados e perfis enviados pelo cliente não autenticam', async () => {
  const forged = Buffer.from(JSON.stringify({user_id: actorIds.alice, username: 'alice.teste'})).toString('base64');
  for (const cookie of [`el_session=${'a'.repeat(64)}`, `discord_session=${forged}`, `el_session=${forged}`]) {
    expectStatus(await call('/api/books', {method: 'POST', headers: {Cookie: cookie}, body: {owner_id: actorIds.alice}}), 401);
  }
  expectStatus(await call('/api/dashboard'), 401);
  expectStatus(await call('/api/requests', {method: 'POST', body: {book_id: 'anything', type: 'emprestimo'}}), 401);
});

test('sessão expirada é rejeitada', async () => {
  const expiredToken = randomBytes(32).toString('hex');
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
    .bind(hash(expiredToken), actorIds.alice, Math.floor(Date.now() / 1000) - 10).run();
  expectStatus(await call('/api/dashboard', {headers: {Cookie: `el_session=${expiredToken}`}}), 401);
});

test('escritas de outra origem ou sem origem são rejeitadas', async () => {
  expectStatus(await call('/api/books', {method: 'POST', actor: 'alice', headers: {Origin: 'https://evil.example'}, body: {}}), 403);
  expectStatus(await call('/api/books', {method: 'POST', actor: 'alice', headers: {Origin: ''}, body: {}}), 403);
});

test('JSON malformado, tipo incorreto e campos inválidos são rejeitados', async () => {
  expectStatus(await call('/api/books', {method: 'POST', actor: 'alice', body: '{broken'}), 400);
  forbidden(await call('/api/books', {method: 'POST', actor: 'alice', body: '{}', headers: {'Content-Type': 'text/plain'}}), [400, 415]);
  const valid = {title: 'Livro', author: 'Autor', category: 'tecnico', condition: 'bom', description: '', mode: 'emprestimo'};
  for (const invalid of [{title: ''}, {title: 'x'.repeat(501)}, {author: ''}, {category: 'invalida'}, {condition: 'invalido'}, {mode: 'venda'}, {description: 'x'.repeat(10001)}]) {
    expectStatus(await call('/api/books', {method: 'POST', actor: 'alice', body: {...valid, ...invalid}}), 400);
  }
});

test('CRUD e filtros persistem no D1 e propriedade vem da sessão', async () => {
  expectStatus(await call('/api/books', {method: 'POST', actor: 'alice', body: {title: 'Teste', author: 'Autor', category: 'tecnico', condition: 'bom', description: '', mode: 'ambos', owner_id: actorIds.bob}}), 400);
  const created = await book('alice', {title: 'Pesquisa SQLite única', category: 'literario'});
  assert.equal(created.owner_id, actorIds.alice);
  const found = expectStatus(await call('/api/books?q=SQLite&category=literario&status=disponivel&mode=troca'), 200).books;
  assert.ok(found.some(item => item.id === created.id));
  assert.ok(!expectStatus(await call('/api/books?q=SQLite&category=tecnico'), 200).books.some(item => item.id === created.id));
  const edited = expectStatus(await call(`/api/books/${created.id}`, {method: 'PATCH', actor: 'alice', body: {
    title: 'Título alterado', author: created.author, category: created.category, condition: created.condition,
    description: created.description, mode: created.mode,
  }}), 200).book;
  assert.equal(edited.title, 'Título alterado');
  expectStatus(await call(`/api/books/${created.id}`, {method: 'DELETE', actor: 'alice', body: {}}), 200);
  assert.ok(!expectStatus(await call('/api/books'), 200).books.some(item => item.id === created.id));
});

test('outro usuário não edita nem exclui exemplar alheio', async () => {
  const created = await book();
  forbidden(await call(`/api/books/${created.id}`, {method: 'PATCH', actor: 'bob', body: {title: 'Roubo'}}));
  forbidden(await call(`/api/books/${created.id}`, {method: 'DELETE', actor: 'bob'}));
  assert.equal((await storedBook(created.id)).owner_id, actorIds.alice);
});

test('busca usa parâmetros SQL sem executar texto do usuário', async () => {
  expectStatus(await call('/api/books?q=' + encodeURIComponent("'; DROP TABLE books;--")), 200);
  const {n} = await db.prepare('SELECT COUNT(*) AS n FROM books').first();
  assert.ok(n > 0);
});

test('não solicita livro próprio nem modalidade não ofertada', async () => {
  const mine = await book('alice');
  forbidden(await call('/api/requests', {method: 'POST', actor: 'alice', body: {book_id: mine.id, type: 'emprestimo'}}), [400, 403]);
  const exchangeOnly = await book('alice', {mode: 'troca'});
  forbidden(await call('/api/requests', {method: 'POST', actor: 'bob', body: {book_id: exchangeOnly.id, type: 'emprestimo'}}), [400, 409]);
});

test('pedido reserva exemplar, registra solicitante e bloqueia edição/exclusão', async () => {
  const created = await book();
  const pending = await request(created.id);
  assert.equal(pending.status, 'pendente');
  assert.equal(pending.requester_id, actorIds.bob);
  assert.equal((await storedBook(created.id)).status, 'reservado');
  expectStatus(await call(`/api/books/${created.id}`, {method: 'PATCH', actor: 'alice', body: {title: 'Alteração durante reserva'}}), 409);
  expectStatus(await call(`/api/books/${created.id}`, {method: 'DELETE', actor: 'alice'}), 409);
  const owner = expectStatus(await call('/api/dashboard', {actor: 'alice'}), 200);
  const borrower = expectStatus(await call('/api/dashboard', {actor: 'bob'}), 200);
  assert.equal(owner.incoming.find(item => item.id === pending.id).requester_username, 'bob.teste');
  assert.equal(borrower.outgoing.find(item => item.id === pending.id).owner_username, 'alice.teste');
  assert.ok(!expectStatus(await call('/api/dashboard', {actor: 'carol'}), 200).incoming.some(item => item.id === pending.id));
});

test('aprovação exige proprietário e data futura válida', async () => {
  const created = await book();
  const pending = await request(created.id);
  forbidden(await action(pending.id, 'approve', 'bob', {due_date: futureDate}));
  forbidden(await action(pending.id, 'approve', 'carol', {due_date: futureDate}));
  for (const due_date of [undefined, '2020-01-01', '2099-02-30', 'amanhã']) {
    expectStatus(await action(pending.id, 'approve', 'alice', {due_date}), 400);
  }
  const approved = expectStatus(await action(pending.id, 'approve', 'alice', {due_date: futureDate}), 200).request;
  assert.equal(approved.status, 'aprovado');
  assert.equal(approved.due_date, futureDate);
  assert.equal((await storedBook(created.id)).status, 'emprestado');
  expectStatus(await action(pending.id, 'approve', 'alice', {due_date: futureDate}), 409);
});

test('devolução libera exemplar apenas após aprovação e pelo proprietário', async () => {
  const created = await book();
  const pending = await request(created.id);
  expectStatus(await action(pending.id, 'return'), 409);
  expectStatus(await action(pending.id, 'approve', 'alice', {due_date: futureDate}), 200);
  forbidden(await action(pending.id, 'return', 'bob'));
  assert.equal(expectStatus(await action(pending.id, 'return'), 200).request.status, 'devolvido');
  assert.equal((await storedBook(created.id)).status, 'disponivel');
  expectStatus(await action(pending.id, 'return'), 409);
  await request(created.id, 'carol');
});

test('recusa libera livro e apenas proprietário pode recusar', async () => {
  const created = await book();
  const pending = await request(created.id);
  forbidden(await action(pending.id, 'reject', 'bob'));
  assert.equal(expectStatus(await action(pending.id, 'reject'), 200).request.status, 'recusado');
  assert.equal((await storedBook(created.id)).status, 'disponivel');
});

test('cancelamento é exclusivo do solicitante enquanto pendente', async () => {
  const created = await book();
  const pending = await request(created.id);
  forbidden(await action(pending.id, 'cancel', 'alice'));
  assert.equal(expectStatus(await action(pending.id, 'cancel', 'bob'), 200).request.status, 'cancelado');
  assert.equal((await storedBook(created.id)).status, 'disponivel');
  const another = await request(created.id);
  expectStatus(await action(another.id, 'approve', 'alice', {due_date: futureDate}), 200);
  expectStatus(await action(another.id, 'cancel', 'bob'), 409);
});

test('duas solicitações concorrentes não reservam o mesmo exemplar', async () => {
  const created = await book();
  const results = await Promise.all(['bob', 'carol'].map(actor => call('/api/requests', {
    method: 'POST', actor, body: {book_id: created.id, type: 'emprestimo'},
  })));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await storedBook(created.id)).status, 'reservado');
});

test('troca exige exemplar oferecido próprio e modalidade compatível', async () => {
  const target = await book();
  const foreign = await book('carol');
  const loanOnly = await book('bob', {mode: 'emprestimo'});
  for (const offered_book_id of [undefined, foreign.id, loanOnly.id, target.id]) {
    forbidden(await call('/api/requests', {method: 'POST', actor: 'bob', body: {book_id: target.id, type: 'troca', offered_book_id}}), [400, 403, 409]);
  }
  assert.equal((await storedBook(target.id)).status, 'disponivel');
});

test('troca reserva ambos, aprova, transfere propriedade e preserva histórico', async () => {
  const target = await book('alice');
  const offered = await book('bob');
  const pending = await request(target.id, 'bob', {type: 'troca', offered_book_id: offered.id});
  assert.equal((await storedBook(target.id)).status, 'reservado');
  assert.equal((await storedBook(offered.id)).status, 'reservado');
  expectStatus(await action(pending.id, 'complete_exchange'), 409);
  expectStatus(await action(pending.id, 'approve'), 200);
  assert.equal((await storedBook(target.id)).status, 'reservado');
  forbidden(await action(pending.id, 'complete_exchange', 'bob'));
  const completed = expectStatus(await action(pending.id, 'complete_exchange'), 200).request;
  assert.equal(completed.status, 'concluido');
  assert.equal(completed.owner_id, actorIds.alice);
  assert.equal(completed.requester_id, actorIds.bob);
  assert.equal((await storedBook(target.id)).owner_id, actorIds.bob);
  assert.equal((await storedBook(offered.id)).owner_id, actorIds.alice);
  assert.equal((await storedBook(target.id)).status, 'disponivel');
  assert.equal((await storedBook(offered.id)).status, 'disponivel');
  expectStatus(await action(pending.id, 'complete_exchange'), 409);
});

test('cancelar ou recusar troca libera os dois exemplares', async () => {
  for (const [actionName, actor] of [['cancel', 'bob'], ['reject', 'alice']]) {
    const target = await book('alice');
    const offered = await book('bob');
    const pending = await request(target.id, 'bob', {type: 'troca', offered_book_id: offered.id});
    expectStatus(await action(pending.id, actionName, actor), 200);
    assert.equal((await storedBook(target.id)).status, 'disponivel');
    assert.equal((await storedBook(offered.id)).status, 'disponivel');
  }
});

test('concorrência por livro oferecido não deixa a outra reserva órfã', async () => {
  const targetA = await book('alice');
  const targetC = await book('carol');
  const offered = await book('bob');
  const results = await Promise.all([targetA.id, targetC.id].map(book_id => call('/api/requests', {
    method: 'POST', actor: 'bob', body: {book_id, type: 'troca', offered_book_id: offered.id},
  })));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const states = await Promise.all([targetA.id, targetC.id].map(async id => (await storedBook(id)).status));
  assert.deepEqual(states.sort(), ['disponivel', 'reservado']);
  assert.equal((await storedBook(offered.id)).status, 'reservado');
});

test('OAuth inicia em identify com state aleatório e cookie seguro', async () => {
  const start = await call('/api/auth/discord');
  expectStatus(start, 302);
  const location = new URL(start.headers.get('Location'));
  assert.equal(location.hostname, 'discord.com');
  assert.equal(location.searchParams.get('scope'), 'identify');
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.equal(location.searchParams.get('redirect_uri'), origin + '/api/auth/discord/callback');
  assert.ok(location.searchParams.get('state').length >= 32);
  const cookie = start.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('callback OAuth sem state válido não cria sessão', async () => {
  const beforeCount = await db.prepare('SELECT COUNT(*) AS n FROM sessions').first();
  const result = await call('/api/auth/discord/callback?code=invalid&state=forged');
  assert.ok([302, 400, 403].includes(result.status));
  assert.doesNotMatch(result.headers.get('Set-Cookie') || '', /el_session=[a-f0-9]{64}/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n, beforeCount.n);
});

test('OAuth completo com Discord simulado cria sessão opaca e consome state uma única vez', async () => {
  const start = await call('/api/auth/discord');
  const state = new URL(start.headers.get('Location')).searchParams.get('state');
  const callback = `/api/auth/discord/callback?code=test-code&state=${state}`;
  const headers = {Cookie: `el_oauth_state=${state}`};
  oauthScenario = {};
  oauthCalls = [];
  try {
    const result = await call(callback, {headers});
    expectStatus(result, 302);
    assert.equal(result.headers.get('Location'), '/?login=success');
    const token = /el_session=([a-f0-9]{64})/.exec(result.headers.get('Set-Cookie'))?.[1];
    assert.ok(token, 'Cookie de sessão opaca ausente');
    assert.match(result.headers.get('Set-Cookie'), /HttpOnly/i);
    assert.match(result.headers.get('Set-Cookie'), /Secure/i);
    const persisted = await db.prepare('SELECT * FROM sessions WHERE token_hash=?').bind(hash(token)).first();
    assert.equal(persisted.user_id, '555555555555555555');
    assert.notEqual(persisted.token_hash, token);
    assert.equal(oauthCalls.length, 2);
    const exchange = new URLSearchParams(oauthCalls[0].body);
    assert.equal(exchange.get('grant_type'), 'authorization_code');
    assert.equal(exchange.get('redirect_uri'), origin + '/api/auth/discord/callback');
    assert.equal(oauthCalls[1].authorization, 'Bearer test-discord-access-token');
    const {user} = expectStatus(await call('/api/me', {headers: {Cookie: `el_session=${token}`}}), 200);
    assert.equal(user.username, 'discord.handle');
    assert.equal(user.display_name, 'Nome do Discord');
    assert.match(user.avatar, /555555555555555555/);
    const replay = await call(callback, {headers});
    assert.match(replay.headers.get('Location'), /auth_error=/);
    assert.equal(oauthCalls.length, 2, 'State reutilizado não deve chegar ao Discord');
  } finally { oauthScenario = null; }
});

test('state OAuth expirado e autorização negada não autenticam', async () => {
  const start = await call('/api/auth/discord');
  const state = new URL(start.headers.get('Location')).searchParams.get('state');
  await db.prepare('UPDATE oauth_states SET expires_at=? WHERE state_hash=?').bind(Math.floor(Date.now()/1000)-1, hash(state)).run();
  const expired = await call(`/api/auth/discord/callback?code=test&state=${state}`, {headers: {Cookie: `el_oauth_state=${state}`}});
  assert.match(expired.headers.get('Location'), /auth_error=/);
  const other = await call('/api/auth/discord');
  const otherState = new URL(other.headers.get('Location')).searchParams.get('state');
  const denied = await call(`/api/auth/discord/callback?error=access_denied&state=${otherState}`, {headers: {Cookie: `el_oauth_state=${otherState}`}});
  assert.match(denied.headers.get('Location'), /auth_error=/);
  assert.doesNotMatch(denied.headers.get('Set-Cookie') || '', /el_session=[a-f0-9]{64}/);
});

test('logout revoga sessão no banco e expira cookie', async () => {
  const logout = await call('/api/logout', {method: 'POST', actor: 'carol', body: {}});
  expectStatus(logout, 200);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/i);
  expectStatus(await call('/api/dashboard', {actor: 'carol'}), 401);
  assert.equal(await db.prepare('SELECT token_hash FROM sessions WHERE token_hash = ?').bind(hash(tokens.carol)).first(), null);
});
