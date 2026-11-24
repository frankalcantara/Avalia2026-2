// Testes de ponta a ponta das Pages Functions, com D1 simulado e Discord mockado.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { onRequestGet as callback } from '../functions/api/auth/discord/callback.js';
import { onRequestGet as login } from '../functions/api/auth/discord.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as dashboard } from '../functions/api/dashboard.js';
import { onRequestPost as createHabit } from '../functions/api/habits/index.js';
import { onRequestPut as toggle } from '../functions/api/habits/[id]/completions.js';
import { onRequestDelete as deleteHabit } from '../functions/api/habits/[id].js';
import { onRequestGet as me } from '../functions/api/me.js';
import { onRequestGet as status } from '../functions/api/status.js';
import { createSession } from '../lib/session.js';
import { todayInTimeZone } from '../lib/stats.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

const ORIGIN = 'https://habits.example.com';
const TZ = 'America/Sao_Paulo';
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const makeEnv = () => ({
  DB: createFakeD1(),
  SESSION_SECRET: 's'.repeat(40),
  DISCORD_CLIENT_ID: '123456',
  DISCORD_CLIENT_SECRET: 'segredo',
  APP_TZ: TZ,
});

const today = () => todayInTimeZone(TZ);
function addDays(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function request(path, { method = 'GET', cookie, body, origin = ORIGIN, contentType = 'application/json' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (origin) headers.set('Origin', origin);
  let payload;
  if (body !== undefined) {
    headers.set('Content-Type', contentType);
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request(`${ORIGIN}${path}`, { method, headers, body: payload });
}

const cookieOf = (res, name) => {
  const line = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return line ? line.split(';')[0] : null;
};

function mockDiscord(user) {
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/oauth2/token')) return Response.json({ access_token: 'tok-abc', token_type: 'Bearer' });
    if (target.endsWith('/users/@me')) return Response.json(user);
    return new Response('not found', { status: 404 });
  };
}

/** Executa o fluxo OAuth completo e devolve o cookie de sessão. */
async function loginAs(env, user = { id: '111111111111111111', username: 'lorenzzo', global_name: 'Lorenzzo', avatar: 'a1b2c3d4' }) {
  mockDiscord(user);
  const start = await login({ request: request('/api/auth/discord'), env });
  const stateCookie = cookieOf(start, 'oauth_state');
  const state = stateCookie.split('=')[1];
  const done = await callback({ request: request(`/api/auth/discord/callback?code=abc&state=${state}`, { cookie: stateCookie }), env });
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('Location'), '/');
  return cookieOf(done, 'session');
}

async function addHabit(env, cookie, name = 'Meditar', extra = {}) {
  const res = await createHabit({ request: request('/api/habits', { method: 'POST', cookie, body: { name, ...extra } }), env });
  return { res, body: await res.json() };
}

const put = (env, cookie, id, body) =>
  toggle({ request: request(`/api/habits/${id}/completions`, { method: 'PUT', cookie, body }), env, params: { id: String(id) } });

/* ---------------- status ---------------- */

test('GET /api/status responde com a chave do projeto e saúde do D1', async () => {
  const res = await status({ env: makeEnv() });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.db, 'ok');
  assert.equal(body.chave, 'P26-2C-7195-ACC2-3B49-1AE1');
});

/* ---------------- OAuth2 ---------------- */

test('login redireciona ao Discord com client_id, scope identify e state em cookie', async () => {
  const res = await login({ request: request('/api/auth/discord'), env: makeEnv() });
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('Location'));
  assert.equal(location.origin + location.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(location.searchParams.get('client_id'), '123456');
  assert.equal(location.searchParams.get('scope'), 'identify');
  assert.equal(location.searchParams.get('redirect_uri'), `${ORIGIN}/api/auth/discord/callback`);
  const stateCookie = cookieOf(res, 'oauth_state');
  assert.equal(location.searchParams.get('state'), stateCookie.split('=')[1]);
  assert.match(res.headers.getSetCookie()[0], /HttpOnly/);
});

test('login sem credenciais configuradas volta com erro de configuração', async () => {
  const env = { ...makeEnv(), DISCORD_CLIENT_ID: undefined };
  const res = await login({ request: request('/api/auth/discord'), env });
  assert.equal(res.headers.get('Location'), '/?erro=config');
});

test('callback rejeita state ausente, divergente ou erro do Discord', async () => {
  const env = makeEnv();
  mockDiscord({ id: '1', username: 'x' });
  const semCookie = await callback({ request: request('/api/auth/discord/callback?code=abc&state=zzz'), env });
  assert.equal(semCookie.headers.get('Location'), '/?erro=state_invalido');
  const divergente = await callback({
    request: request('/api/auth/discord/callback?code=abc&state=zzz', { cookie: 'oauth_state=outro' }), env });
  assert.equal(divergente.headers.get('Location'), '/?erro=state_invalido');
  const negado = await callback({ request: request('/api/auth/discord/callback?error=access_denied'), env });
  assert.equal(negado.headers.get('Location'), '/?erro=login_cancelado');
});

test('callback importa user_id, nome e avatar, grava no D1 e abre a sessão', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind('111111111111111111').first();
  assert.equal(row.username, 'lorenzzo');
  assert.equal(row.display_name, 'Lorenzzo');
  assert.equal(row.avatar, 'a1b2c3d4');

  const res = await me({ request: request('/api/me', { cookie }), env });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.user.id, '111111111111111111');
  assert.equal(body.user.displayName, 'Lorenzzo');
  assert.equal(body.user.avatarUrl, 'https://cdn.discordapp.com/avatars/111111111111111111/a1b2c3d4.png?size=128');
});

test('segundo login atualiza o usuário (upsert) sem duplicar', async () => {
  const env = makeEnv();
  await loginAs(env, { id: '222', username: 'antigo', global_name: null, avatar: null });
  await loginAs(env, { id: '222', username: 'novo', global_name: 'Novo Nome', avatar: 'ffee' });
  const rows = (await env.DB.prepare('SELECT * FROM users').all()).results;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, 'novo');
  assert.equal(rows[0].avatar, 'ffee');
});

test('usuário sem avatar recebe o avatar padrão do Discord', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env, { id: '333', username: 'semavatar', global_name: null, avatar: null });
  const body = await (await me({ request: request('/api/me', { cookie }), env })).json();
  assert.match(body.user.avatarUrl, /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
  assert.equal(body.user.displayName, 'semavatar');
});

test('falha do Discord na troca do code não abre sessão', async () => {
  const env = makeEnv();
  globalThis.fetch = async () => new Response('{}', { status: 400 });
  const start = await login({ request: request('/api/auth/discord'), env });
  const stateCookie = cookieOf(start, 'oauth_state');
  const res = await callback({
    request: request(`/api/auth/discord/callback?code=abc&state=${stateCookie.split('=')[1]}`, { cookie: stateCookie }), env });
  assert.equal(res.headers.get('Location'), '/?erro=falha_discord');
  assert.equal(cookieOf(res, 'session'), null);
});

/* ---------------- sessão ---------------- */

test('rotas protegidas exigem login (401)', async () => {
  const env = makeEnv();
  assert.equal((await me({ request: request('/api/me'), env })).status, 401);
  assert.equal((await dashboard({ request: request('/api/dashboard'), env })).status, 401);
  assert.equal((await createHabit({ request: request('/api/habits', { method: 'POST', body: { name: 'x' } }), env })).status, 401);
  assert.equal((await put(env, undefined, 1, { date: today(), done: true })).status, 401);
});

test('cookie adulterado ou expirado é rejeitado', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const adulterado = `${cookie.slice(0, -3)}AAA`;
  assert.equal((await me({ request: request('/api/me', { cookie: adulterado }), env })).status, 401);

  const expirado = `session=${await createSession(env.SESSION_SECRET, '111111111111111111', -10)}`;
  assert.equal((await me({ request: request('/api/me', { cookie: expirado }), env })).status, 401);

  const outroSegredo = `session=${await createSession('x'.repeat(40), '111111111111111111')}`;
  assert.equal((await me({ request: request('/api/me', { cookie: outroSegredo }), env })).status, 401);
});

test('logout apaga o cookie e exige mesma origem', async () => {
  const res = await logout({ request: request('/api/auth/logout', { method: 'POST' }) });
  assert.equal(res.status, 200);
  assert.match(res.headers.getSetCookie()[0], /^session=; .*Max-Age=0/);
  const bloqueado = await logout({ request: request('/api/auth/logout', { method: 'POST', origin: 'https://evil.example' }) });
  assert.equal(bloqueado.status, 403);
});

/* ---------------- hábitos ---------------- */

test('cadastra hábito, normaliza o nome e devolve 201', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const { res, body } = await addHabit(env, cookie, '  Ler   20  minutos ', { color: '#A78BFA' });
  assert.equal(res.status, 201);
  assert.equal(body.habit.name, 'Ler 20 minutos');
  assert.equal(body.habit.color, '#a78bfa');
  assert.ok(Number.isInteger(body.habit.id));
});

test('valida nome, cor, tipo de conteúdo, JSON e origem na criação de hábito', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  assert.equal((await addHabit(env, cookie, '   ')).res.status, 400);
  assert.equal((await addHabit(env, cookie, 'x'.repeat(61))).res.status, 400);
  assert.equal((await addHabit(env, cookie, 'Ok', { color: 'vermelho' })).res.status, 400);
  assert.equal((await createHabit({ request: request('/api/habits', { method: 'POST', cookie, body: { name: 123 } }), env })).status, 400);
  assert.equal((await createHabit({ request: request('/api/habits', { method: 'POST', cookie, body: '{ruim', }), env })).status, 400);
  assert.equal((await createHabit({ request: request('/api/habits', { method: 'POST', cookie, body: 'name=x', contentType: 'text/plain' }), env })).status, 415);
  assert.equal((await createHabit({ request: request('/api/habits', { method: 'POST', cookie, body: { name: 'Ok' }, origin: 'https://evil.example' }), env })).status, 403);
  assert.equal((await createHabit({ request: request('/api/habits', { method: 'POST', cookie, body: { name: 'Ok' }, origin: null }), env })).status, 403);
});

test('nome duplicado (sem diferenciar maiúsculas) retorna 409; limite de 30 hábitos', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  assert.equal((await addHabit(env, cookie, 'Correr')).res.status, 201);
  assert.equal((await addHabit(env, cookie, 'correr')).res.status, 409);
  for (let i = 2; i <= 30; i += 1) assert.equal((await addHabit(env, cookie, `Hábito ${i}`)).res.status, 201);
  assert.equal((await addHabit(env, cookie, 'Hábito 31')).res.status, 409);
});

/* ---------------- conclusões e métricas ---------------- */

test('marcar/desmarcar atualiza o D1 e devolve métricas recalculadas pelo servidor', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const { body: { habit } } = await addHabit(env, cookie);

  const t = today();
  const y = addDays(t, -1);
  await put(env, cookie, habit.id, { date: y, done: true });
  const res = await put(env, cookie, habit.id, { date: t, done: true });
  const data = await res.json();
  assert.equal(res.status, 200);

  const h = data.habits[0];
  assert.equal(h.stats.currentStreak, 2);
  assert.equal(h.stats.maxStreak, 2);
  const noMes = [y, t].filter((d) => d.startsWith(t.slice(0, 7)));
  assert.deepEqual(h.completedDates, noMes);
  assert.equal(h.stats.monthCompleted, noMes.length);
  assert.equal(data.overall.currentStreak, 2);

  // idempotente: marcar de novo não duplica
  await put(env, cookie, habit.id, { date: t, done: true });
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM completions WHERE habit_id = ?').bind(habit.id).first('n');
  assert.equal(count, 2);

  // desmarcar hoje: o streak atual continua (termina ontem) e o D1 reflete
  const undone = await (await put(env, cookie, habit.id, { date: t, done: false })).json();
  assert.equal(undone.habits[0].stats.currentStreak, 1);
  assert.equal(undone.habits[0].stats.maxStreak, 1);
});

test('GET /api/dashboard valida o mês e calcula taxa/streak de um mês passado', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const { body: { habit } } = await addHabit(env, cookie);

  for (const date of ['2025-03-10', '2025-03-11', '2025-03-12', '2025-03-20']) {
    assert.equal((await put(env, cookie, habit.id, { date, done: true })).status, 200);
  }
  const res = await dashboard({ request: request('/api/dashboard?month=2025-03', { cookie }), env });
  const data = await res.json();
  assert.equal(data.month, '2025-03');
  assert.equal(data.daysInMonth, 31);
  assert.deepEqual(data.habits[0].completedDates, ['2025-03-10', '2025-03-11', '2025-03-12', '2025-03-20']);
  assert.equal(data.habits[0].stats.maxStreak, 3);
  assert.equal(data.habits[0].stats.currentStreak, 0);
  assert.equal(data.habits[0].stats.monthEligible, 31);
  assert.equal(data.habits[0].stats.monthRate, 12.9);
  assert.equal(data.overall.monthRate, 12.9);

  assert.equal((await dashboard({ request: request('/api/dashboard?month=2025-13', { cookie }), env })).status, 400);
  assert.equal((await dashboard({ request: request('/api/dashboard?month=abc', { cookie }), env })).status, 400);
  const padrao = await (await dashboard({ request: request('/api/dashboard', { cookie }), env })).json();
  assert.equal(padrao.month, today().slice(0, 7));
});

test('o servidor valida data, tipo de "done", dias futuros e propriedade do hábito', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const outro = await loginAs(env, { id: '999', username: 'outra', global_name: null, avatar: null });
  const { body: { habit } } = await addHabit(env, cookie);

  assert.equal((await put(env, cookie, habit.id, { date: '2026-02-30', done: true })).status, 400);
  assert.equal((await put(env, cookie, habit.id, { date: 'ontem', done: true })).status, 400);
  assert.equal((await put(env, cookie, habit.id, { date: today(), done: 'sim' })).status, 400);
  assert.equal((await put(env, cookie, habit.id, { date: today() })).status, 400);
  const futuro = await put(env, cookie, habit.id, { date: addDays(today(), 1), done: true });
  assert.equal(futuro.status, 400);
  assert.equal((await futuro.json()).error.code, 'future_date');
  assert.equal((await put(env, cookie, 'abc', { date: today(), done: true })).status, 400);
  assert.equal((await put(env, cookie, 9999, { date: today(), done: true })).status, 404);
  // hábito de outro usuário
  assert.equal((await put(env, outro, habit.id, { date: today(), done: true })).status, 404);

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM completions').first('n');
  assert.equal(count, 0);
});

test('usuários não enxergam hábitos uns dos outros', async () => {
  const env = makeEnv();
  const a = await loginAs(env);
  const b = await loginAs(env, { id: '999', username: 'outra', global_name: null, avatar: null });
  await addHabit(env, a, 'Só da A');
  const dashB = await (await dashboard({ request: request('/api/dashboard', { cookie: b }), env })).json();
  assert.equal(dashB.habits.length, 0);
});

test('excluir hábito remove também as conclusões; só o dono pode excluir', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const outro = await loginAs(env, { id: '999', username: 'outra', global_name: null, avatar: null });
  const { body: { habit } } = await addHabit(env, cookie);
  await put(env, cookie, habit.id, { date: today(), done: true });

  const del = (c, id) => deleteHabit({
    request: request(`/api/habits/${id}`, { method: 'DELETE', cookie: c }), env, params: { id: String(id) } });

  assert.equal((await del(outro, habit.id)).status, 404);
  assert.equal((await del(cookie, 'xyz')).status, 400);
  assert.equal((await del(cookie, habit.id)).status, 200);
  assert.equal(await env.DB.prepare('SELECT COUNT(*) AS n FROM completions').first('n'), 0);
  assert.equal(await env.DB.prepare('SELECT COUNT(*) AS n FROM habits').first('n'), 0);
  assert.equal((await del(cookie, habit.id)).status, 404);
});

test('mutações via DELETE também exigem mesma origem', async () => {
  const env = makeEnv();
  const cookie = await loginAs(env);
  const { body: { habit } } = await addHabit(env, cookie);
  const res = await deleteHabit({
    request: request(`/api/habits/${habit.id}`, { method: 'DELETE', cookie, origin: 'https://evil.example' }),
    env, params: { id: String(habit.id) } });
  assert.equal(res.status, 403);
});
