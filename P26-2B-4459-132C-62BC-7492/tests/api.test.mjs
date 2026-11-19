// Testes de integração das Pages Functions contra um D1 simulado (node:sqlite).
// Rodar: npm test   (Node >= 22)
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createD1 } from './helpers/d1.mjs';
import { createSession, randomToken } from '../functions/_lib/auth.js';
import { computePoints } from '../functions/_lib/scoring.js';
import { GRACE_MS } from '../functions/_lib/config.js';
import * as meRoute from '../functions/api/me.js';
import * as categoriesRoute from '../functions/api/categories.js';
import * as rankingRoute from '../functions/api/ranking.js';
import * as startRoute from '../functions/api/quiz/start.js';
import * as nextRoute from '../functions/api/quiz/next.js';
import * as answerRoute from '../functions/api/quiz/answer.js';
import * as loginRoute from '../functions/api/auth/login.js';
import * as callbackRoute from '../functions/api/auth/callback.js';
import * as logoutRoute from '../functions/api/auth/logout.js';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');
const ORIGIN = 'https://quiz.test';
const LIMIT = 15000;

afterEach(() => mock.restoreAll());

// ---------- helpers ----------
function setup() {
  const db = createD1();
  db._sqlite.exec(schema);
  db._sqlite.exec(seed);
  return { env: { DB: db, DISCORD_CLIENT_ID: '123456789', DISCORD_CLIENT_SECRET: 'segredo' }, db };
}

function freezeClock(start = 1_800_000_000_000) {
  const clock = { t: start };
  mock.method(Date, 'now', () => clock.t);
  return clock;
}

async function login(env, id = '111111111111111111', name = 'Aluno Teste') {
  const now = Date.now();
  await env.DB
    .prepare('INSERT INTO users (id, name, avatar, created_at, last_login_at) VALUES (?, ?, NULL, ?, ?)')
    .bind(id, name, now, now)
    .run();
  return `sid=${await createSession(env.DB, id, now)}`;
}

function request(method, path, { cookie, body, origin = ORIGIN, contentType = 'application/json' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (method === 'POST') {
    if (origin) headers.set('origin', origin);
    if (contentType) headers.set('content-type', contentType);
  }
  return new Request(ORIGIN + path, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(route, env, req) {
  const handler = req.method === 'GET' ? route.onRequestGet : route.onRequestPost;
  const res = await handler({ request: req, env });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* corpo não-JSON (redirects) */
  }
  return { status: res.status, headers: res.headers, data, text };
}

const post = (route, env, cookie, body, extra = {}) => call(route, env, request('POST', '/x', { cookie, body, ...extra }));

async function startQuiz(env, cookie, categoryId = 'web') {
  const r = await post(startRoute, env, cookie, { categoryId });
  assert.equal(r.status, 200, r.text);
  return r.data;
}

const nextQuestion = async (env, cookie, quizId) => (await post(nextRoute, env, cookie, { quizId })).data;

/** Índice EXIBIDO da alternativa correta (lido direto do D1 — o cliente nunca tem essa informação). */
async function correctDisplayed(db, quizId, position) {
  const row = await db
    .prepare('SELECT i.option_order, q.correct_index FROM quiz_items i JOIN questions q ON q.id = i.question_id WHERE i.quiz_id = ? AND i.position = ?')
    .bind(quizId, position)
    .first();
  return JSON.parse(row.option_order).indexOf(row.correct_index);
}

// ---------- testes ----------
test('pontuação: limites e monotonicidade', () => {
  assert.equal(computePoints(0, LIMIT), 1000);
  assert.equal(computePoints(LIMIT, LIMIT), 100);
  assert.equal(computePoints(LIMIT / 2, LIMIT), 550);
  assert.equal(computePoints(-50, LIMIT), 1000);
  assert.equal(computePoints(LIMIT * 3, LIMIT), 100);
  let prev = Infinity;
  for (let e = 0; e <= LIMIT; e += 500) {
    const p = computePoints(e, LIMIT);
    assert.ok(p <= prev, 'a pontuação nunca aumenta com o tempo');
    prev = p;
  }
});

test('seed: categorias com banco suficiente e alternativas válidas', async () => {
  const { db } = setup();
  const { results: cats } = await db.prepare('SELECT category_id, COUNT(*) AS n FROM questions GROUP BY category_id').all();
  assert.ok(cats.length >= 3);
  for (const c of cats) assert.ok(c.n >= 10, `categoria ${c.category_id} tem ${c.n} questões`);
  const { results: qs } = await db.prepare('SELECT * FROM questions').all();
  for (const q of qs) {
    const opts = JSON.parse(q.options);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4, `alternativas repetidas em ${q.id}`);
    assert.ok(q.correct_index >= 0 && q.correct_index <= 3);
  }
});

test('rotas protegidas exigem login (401)', async () => {
  const { env } = setup();
  assert.equal((await call(meRoute, env, request('GET', '/api/me'))).status, 401);
  assert.equal((await call(categoriesRoute, env, request('GET', '/api/categories'))).status, 401);
  assert.equal((await call(rankingRoute, env, request('GET', '/api/ranking?categoryId=web'))).status, 401);
  for (const route of [startRoute, nextRoute, answerRoute]) {
    assert.equal((await post(route, env, undefined, {})).status, 401);
  }
  // cookie forjado
  assert.equal((await call(meRoute, env, request('GET', '/api/me', { cookie: `sid=${randomToken(32)}` }))).status, 401);
});

test('CSRF: POST sem Origin igual ao do site é rejeitado', async () => {
  const { env } = setup();
  const cookie = await login(env);
  assert.equal((await post(startRoute, env, cookie, { categoryId: 'web' }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await post(startRoute, env, cookie, { categoryId: 'web' }, { origin: null })).status, 403);
  assert.equal((await post(logoutRoute, env, cookie, {}, { origin: 'https://evil.test' })).status, 403);
});

test('entrada inválida → 400', async () => {
  const { env } = setup();
  const cookie = await login(env);
  assert.equal((await post(startRoute, env, cookie, { categoryId: 'x; DROP TABLE users' })).status, 400);
  assert.equal((await post(startRoute, env, cookie, {}, { contentType: 'text/plain' })).status, 400);
  assert.equal((await post(startRoute, env, cookie, '{não é json')).status, 400);
  assert.equal((await post(startRoute, env, cookie, { categoryId: 'inexistente' })).status, 404);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  for (const bad of [{ position: 0, choice: 7 }, { position: 0, choice: 'a' }, { position: 0 }, { position: -1, choice: 0 }, { position: 'x', choice: 0 }]) {
    assert.equal((await post(answerRoute, env, cookie, { quizId, ...bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal((await post(nextRoute, env, cookie, { quizId: '../../etc' })).status, 400);
});

test('categorias: lista com contagem de questões', async () => {
  const { env } = setup();
  const cookie = await login(env);
  const r = await call(categoriesRoute, env, request('GET', '/api/categories', { cookie }));
  assert.equal(r.status, 200);
  assert.equal(r.data.categories.length, 4);
  assert.ok(r.data.categories.every((c) => c.questionCount >= 10));
});

test('a pergunta entregue NÃO contém o gabarito', async () => {
  const { env, db } = setup();
  const cookie = await login(env);
  const { quizId, total } = await startQuiz(env, cookie);
  assert.equal(total, 10);
  const r = await post(nextRoute, env, cookie, { quizId });
  assert.equal(r.status, 200);
  assert.equal(r.data.done, false);
  assert.deepEqual(Object.keys(r.data.question).sort(), ['number', 'options', 'position', 'quizId', 'remainingMs', 'score', 'text', 'timeLimitMs', 'total']);
  assert.equal(r.data.question.options.length, 4);
  assert.equal(r.data.question.remainingMs, LIMIT);
  assert.doesNotMatch(r.text, /correct|gabarito|answer|solution/i);

  // e o servidor sabe a resposta certa (está só no D1)
  const idx = await correctDisplayed(db, quizId, 0);
  assert.ok(idx >= 0 && idx <= 3);
});

test('pontuação proporcional à velocidade e 0 para erro', async () => {
  const { env, db } = setup();
  const clock = freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);

  // 1) acerto instantâneo → 1000
  await nextQuestion(env, cookie, quizId);
  let r = await post(answerRoute, env, cookie, { quizId, position: 0, choice: await correctDisplayed(db, quizId, 0) });
  assert.equal(r.status, 200);
  assert.equal(r.data.result, 'correct');
  assert.equal(r.data.points, 1000);
  assert.equal(r.data.elapsedMs, 0);

  // 2) acerto na metade do tempo → 550
  await nextQuestion(env, cookie, quizId);
  clock.t += LIMIT / 2;
  r = await post(answerRoute, env, cookie, { quizId, position: 1, choice: await correctDisplayed(db, quizId, 1) });
  assert.equal(r.data.points, 550);
  assert.equal(r.data.score, 1550);

  // 3) erro → 0, e o gabarito é revelado só depois
  await nextQuestion(env, cookie, quizId);
  const right = await correctDisplayed(db, quizId, 2);
  r = await post(answerRoute, env, cookie, { quizId, position: 2, choice: (right + 1) % 4 });
  assert.equal(r.data.result, 'wrong');
  assert.equal(r.data.points, 0);
  assert.equal(r.data.correctIndex, right);
  assert.equal(r.data.score, 1550);
});

test('resposta APÓS o limite é bloqueada (408) e não pontua', async () => {
  const { env, db } = setup();
  const clock = freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  const right = await correctDisplayed(db, quizId, 0);

  clock.t += LIMIT + GRACE_MS + 1;
  const late = await post(answerRoute, env, cookie, { quizId, position: 0, choice: right });
  assert.equal(late.status, 408);
  assert.equal(late.data.accepted, false);
  assert.equal(late.data.result, 'timeout');
  assert.equal(late.data.points, 0);
  assert.equal(late.data.correctIndex, null, 'não revela o gabarito em timeout');
  assert.equal(late.data.score, 0);

  // a pergunta fica encerrada: não dá para tentar de novo
  const again = await post(answerRoute, env, cookie, { quizId, position: 0, choice: right });
  assert.equal(again.status, 409);
  assert.equal(again.data.error, 'already_answered');
});

test('tolerância de rede: dentro de GRACE_MS aceita com pontuação mínima', async () => {
  const { env, db } = setup();
  const clock = freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  clock.t += LIMIT + GRACE_MS - 1;
  const r = await post(answerRoute, env, cookie, { quizId, position: 0, choice: await correctDisplayed(db, quizId, 0) });
  assert.equal(r.status, 200);
  assert.equal(r.data.points, 100);
});

test('choice:null → skipped antes do limite e timeout depois; sem gabarito', async () => {
  const { env } = setup();
  const clock = freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  let r = await post(answerRoute, env, cookie, { quizId, position: 0, choice: null });
  assert.equal(r.status, 200);
  assert.equal(r.data.result, 'skipped');
  assert.equal(r.data.correctIndex, null);

  await nextQuestion(env, cookie, quizId);
  clock.t += LIMIT;
  r = await post(answerRoute, env, cookie, { quizId, position: 1, choice: null });
  assert.equal(r.status, 200);
  assert.equal(r.data.result, 'timeout');
  assert.equal(r.data.points, 0);
});

test('duplo envio da mesma pergunta não pontua duas vezes', async () => {
  const { env, db } = setup();
  freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  const body = { quizId, position: 0, choice: await correctDisplayed(db, quizId, 0) };
  const first = await post(answerRoute, env, cookie, body);
  const second = await post(answerRoute, env, cookie, body);
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  const score = await db.prepare('SELECT score FROM quiz_sessions WHERE id = ?').bind(quizId).first('score');
  assert.equal(score, 1000);
});

test('envios CONCORRENTES: só um é gravado', async () => {
  const { env, db } = setup();
  freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  const body = { quizId, position: 0, choice: await correctDisplayed(db, quizId, 0) };
  const results = await Promise.all([post(answerRoute, env, cookie, body), post(answerRoute, env, cookie, body), post(answerRoute, env, cookie, body)]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 2);
  assert.equal(await db.prepare('SELECT score FROM quiz_sessions WHERE id = ?').bind(quizId).first('score'), 1000);
});

test('não aceita resposta de pergunta ainda não entregue', async () => {
  const { env } = setup();
  freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  let r = await post(answerRoute, env, cookie, { quizId, position: 0, choice: 0 });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'not_sent');
  await nextQuestion(env, cookie, quizId); // entrega só a 0
  r = await post(answerRoute, env, cookie, { quizId, position: 1, choice: 0 });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'not_sent');
});

test('isolamento: outro usuário não acessa o quiz alheio', async () => {
  const { env } = setup();
  const a = await login(env, '111111111111111111', 'A');
  const b = await login(env, '222222222222222222', 'B');
  const { quizId } = await startQuiz(env, a);
  await nextQuestion(env, a, quizId);
  assert.equal((await post(nextRoute, env, b, { quizId })).status, 404);
  assert.equal((await post(answerRoute, env, b, { quizId, position: 0, choice: 0 })).status, 404);
});

test('recarregar a página não reinicia o cronômetro (sent_at preservado)', async () => {
  const { env, db } = setup();
  const clock = freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  const first = await nextQuestion(env, cookie, quizId);
  const sent = await db.prepare('SELECT sent_at FROM quiz_items WHERE quiz_id = ? AND position = 0').bind(quizId).first('sent_at');
  clock.t += 4000;
  const second = await nextQuestion(env, cookie, quizId);
  assert.equal(second.question.text, first.question.text);
  assert.deepEqual(second.question.options, first.question.options);
  assert.equal(second.question.remainingMs, LIMIT - 4000);
  assert.equal(await db.prepare('SELECT sent_at FROM quiz_items WHERE quiz_id = ? AND position = 0').bind(quizId).first('sent_at'), sent);
});

test('pergunta expirada é encerrada como timeout e o quiz avança', async () => {
  const { env, db } = setup();
  const clock = freezeClock();
  const cookie = await login(env);
  const { quizId } = await startQuiz(env, cookie);
  await nextQuestion(env, cookie, quizId);
  clock.t += LIMIT + 1;
  const r = await nextQuestion(env, cookie, quizId);
  assert.equal(r.question.number, 2);
  assert.equal(r.question.remainingMs, LIMIT);
  const item = await db.prepare('SELECT result, points FROM quiz_items WHERE quiz_id = ? AND position = 0').bind(quizId).first();
  assert.equal(item.result, 'timeout');
  assert.equal(item.points, 0);
});

test('quiz completo: finaliza, devolve revisão e alimenta o ranking', async () => {
  const { env, db } = setup();
  const clock = freezeClock();
  const ana = await login(env, '111111111111111111', 'Ana');
  const beto = await login(env, '222222222222222222', 'Beto');

  async function play(cookie, correct) {
    const { quizId, total } = await startQuiz(env, cookie, 'mat');
    let last;
    for (let i = 0; i < total; i++) {
      const q = (await nextQuestion(env, cookie, quizId)).question;
      assert.equal(q.number, i + 1);
      const right = await correctDisplayed(db, quizId, i);
      clock.t += 1000;
      last = await post(answerRoute, env, cookie, { quizId, position: i, choice: correct ? right : (right + 1) % 4 });
    }
    assert.equal(last.data.finished, true);
    const done = await nextQuestion(env, cookie, quizId);
    assert.equal(done.done, true);
    assert.equal(done.summary.total, 10);
    assert.equal(done.summary.review.length, 10);
    assert.equal(typeof done.summary.review[0].correctIndex, 'number');
    assert.equal(await db.prepare('SELECT status FROM quiz_sessions WHERE id = ?').bind(quizId).first('status'), 'finished');
    return done.summary;
  }

  const sAna = await play(ana, true);
  assert.equal(sAna.correctCount, 10);
  assert.equal(sAna.score, 10 * computePoints(1000, LIMIT));
  const sBeto = await play(beto, false);
  assert.equal(sBeto.score, 0);

  const rk = await call(rankingRoute, env, request('GET', '/api/ranking?categoryId=mat', { cookie: beto }));
  assert.equal(rk.status, 200);
  assert.equal(rk.data.ranking[0].name, 'Ana');
  assert.equal(rk.data.ranking[0].best, sAna.score);
  assert.equal(rk.data.ranking[1].isMe, true);
  assert.equal(rk.data.me.rank, 2);
  assert.doesNotMatch(rk.text, /111111111111111111|222222222222222222/, 'ranking não expõe user_id');
  assert.equal((await call(rankingRoute, env, request('GET', '/api/ranking?categoryId=nao-existe', { cookie: ana }))).status, 404);
});

test('novo quiz abandona o anterior; limite de quizzes por minuto', async () => {
  const { env, db } = setup();
  freezeClock();
  const cookie = await login(env);
  const first = await startQuiz(env, cookie);
  const second = await startQuiz(env, cookie);
  assert.equal(await db.prepare('SELECT status FROM quiz_sessions WHERE id = ?').bind(first.quizId).first('status'), 'abandoned');
  assert.equal((await post(nextRoute, env, cookie, { quizId: first.quizId })).status, 409);
  assert.equal((await post(answerRoute, env, cookie, { quizId: first.quizId, position: 0, choice: 0 })).status, 409);
  assert.equal((await nextQuestion(env, cookie, second.quizId)).done, false);

  for (let i = 0; i < 4; i++) await startQuiz(env, cookie); // 6 no total
  assert.equal((await post(startRoute, env, cookie, { categoryId: 'web' })).status, 429);
});

test('OAuth2: login redireciona ao Discord com state; callback valida e cria sessão', async () => {
  const { env, db } = setup();
  freezeClock();

  const l = await call(loginRoute, env, request('GET', '/api/auth/login'));
  assert.equal(l.status, 302);
  const target = new URL(l.headers.get('location'));
  assert.equal(target.origin + target.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(target.searchParams.get('client_id'), env.DISCORD_CLIENT_ID);
  assert.equal(target.searchParams.get('scope'), 'identify');
  assert.equal(target.searchParams.get('redirect_uri'), `${ORIGIN}/api/auth/callback`);
  const state = target.searchParams.get('state');
  const stateCookie = l.headers.getSetCookie().find((c) => c.startsWith('oauth_state='));
  assert.match(stateCookie, /HttpOnly/);
  assert.ok(stateCookie.includes(state));

  // state divergente → erro, sem sessão
  const badState = await call(callbackRoute, env, request('GET', '/api/auth/callback?code=abc&state=outro', { cookie: `oauth_state=${state}` }));
  assert.equal(badState.status, 302);
  assert.equal(badState.headers.get('location'), '/?erro=state');
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM sessions').first('n'), 0);

  // caminho feliz com o Discord simulado
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).endsWith('/oauth2/token')) {
      assert.equal(init.method, 'POST');
      const form = new URLSearchParams(init.body);
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.equal(form.get('code'), 'codigo-valido');
      assert.equal(form.get('client_secret'), 'segredo');
      return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
    }
    assert.equal(init.headers.authorization, 'Bearer tok');
    return new Response(JSON.stringify({ id: '987654321098765432', username: 'bernardo', global_name: 'Bernardo', avatar: 'abc123' }), { status: 200 });
  });
  const ok = await call(callbackRoute, env, request('GET', `/api/auth/callback?code=codigo-valido&state=${state}`, { cookie: `oauth_state=${state}` }));
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), '/');
  assert.equal(calls.length, 2);
  const cookies = ok.headers.getSetCookie();
  const sid = cookies.find((c) => c.startsWith('sid='));
  assert.match(sid, /HttpOnly/);
  assert.match(sid, /SameSite=Lax/);
  assert.match(sid, /Secure/);
  assert.ok(cookies.find((c) => c.startsWith('oauth_state=;')), 'state é descartado após o uso');

  const user = await db.prepare('SELECT * FROM users').first();
  assert.deepEqual([user.id, user.name, user.avatar], ['987654321098765432', 'Bernardo', 'abc123']);

  const me = await call(meRoute, env, request('GET', '/api/me', { cookie: sid.split(';')[0] }));
  assert.equal(me.status, 200);
  assert.equal(me.data.user.name, 'Bernardo');
  assert.equal(me.data.user.avatarUrl, 'https://cdn.discordapp.com/avatars/987654321098765432/abc123.png?size=128');

  // logout invalida a sessão
  const out = await post(logoutRoute, env, sid.split(';')[0], {});
  assert.equal(out.status, 200);
  assert.equal((await call(meRoute, env, request('GET', '/api/me', { cookie: sid.split(';')[0] }))).status, 401);
});

test('OAuth2: Discord recusa o code → redireciona com erro e sem sessão', async () => {
  const { env, db } = setup();
  mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 400 }));
  const res = await call(callbackRoute, env, request('GET', '/api/auth/callback?code=x&state=s', { cookie: 'oauth_state=s' }));
  assert.equal(res.headers.get('location'), '/?erro=token');
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM sessions').first('n'), 0);
  const denied = await call(callbackRoute, env, request('GET', '/api/auth/callback?error=access_denied'));
  assert.equal(denied.headers.get('location'), '/?erro=negado');
});
