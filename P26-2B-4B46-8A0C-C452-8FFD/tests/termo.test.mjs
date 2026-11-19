import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import * as game from '../functions/api/game.js';
import { dailyAnswer, scoreGuess } from '../functions/lib/termo.js';

const origin = 'https://termo.test';
const migration = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');

// Adaptador para executar as funções de Pages contra o SQL real, sem contas externas.
function d1Local(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration);
  t.after(() => sqlite.close());

  function prepare(sql, params = []) {
    const stmt = sqlite.prepare(sql);
    return {
      bind: (...values) => prepare(sql, values),
      async first(column) {
        const row = stmt.get(...params);
        return column ? row?.[column] ?? null : row ?? null;
      },
      async all() {
        return { success: true, results: stmt.all(...params) };
      },
      async run() {
        const { changes, lastInsertRowid } = stmt.run(...params);
        return { success: true, meta: { changes, last_row_id: lastInsertRowid }, results: [] };
      },
      async raw() {
        stmt.setReturnArrays(true);
        return stmt.all(...params);
      },
    };
  }

  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of statements) results.push(await stmt.all());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function fixture(t) {
  return {
    DB: d1Local(t),
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_CLIENT_SECRET: 'discord-local-fixture',
    SESSION_SECRET: 'test-only-session-key-12345678901234567890',
    DAILY_WORD_SECRET: 'test-only-daily-key-12345678901234567890',
  };
}

function request(path, { method = 'GET', cookie, body } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (method === 'POST') headers.set('Origin', origin);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(origin + path, { method, headers, body: body && JSON.stringify(body) });
}

function cookies(response) {
  return response.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
}

async function getGame(env, cookie) {
  return game.onRequestGet({ env, request: request('/api/game', { cookie }) });
}

async function postGuess(env, cookie, body) {
  return game.onRequestPost({ env, request: request('/api/game', { method: 'POST', cookie, body }) });
}

test('letras repetidas respeitam a quantidade da resposta', () => {
  assert.deepEqual(scoreGuess('ARARA', 'ACASO'), ['correct', 'absent', 'correct', 'absent', 'absent']);
  assert.deepEqual(scoreGuess('ARARA', 'BARCO'), ['present', 'present', 'absent', 'absent', 'absent']);
});

test('tabuleiro e envio de tentativa exigem sessão', async (t) => {
  const env = fixture(t);
  const view = await getGame(env);
  const guess = await postGuess(env, undefined, { date: '2026-11-12', guess: 'TESTE' });
  assert.equal(view.status, 401);
  assert.equal(guess.status, 401);
});

async function login(t, env, userId = '123456789012345678') {
  const { onRequestGet: authorize } = await import('../functions/api/auth/discord.js');
  const { onRequestGet: callback } = await import('../functions/api/auth/discord/callback.js');
  const start = await authorize({ env, request: request('/api/auth/discord') });
  assert.equal(start.status, 302);
  const target = new URL(start.headers.get('Location'));
  assert.equal(target.hostname, 'discord.com');
  assert.equal(target.searchParams.get('scope'), 'identify');
  const state = target.searchParams.get('state');
  assert.ok(state);

  const discordFetch = t.mock.method(globalThis, 'fetch', async (url) => {
    const endpoint = new URL(url instanceof Request ? url.url : url);
    if (endpoint.pathname === '/api/oauth2/token') return Response.json({ access_token: 'fixture-token', token_type: 'Bearer' });
    if (endpoint.pathname === '/api/users/@me') {
      return Response.json({ id: userId, username: 'pedro_teste', global_name: 'Pedro Teste', avatar: 'a0123' });
    }
    throw new Error('URL inesperada: ' + endpoint.href);
  });

  try {
    const callbackPath = '/api/auth/discord/callback?' + new URLSearchParams({ code: 'fixture-code', state });
    const result = await callback({ env, request: request(callbackPath, { cookie: cookies(start) }) });
    assert.equal(result.status, 302);
    assert.equal(result.headers.get('Location'), '/');
    assert.equal(discordFetch.mock.callCount(), 2);
    assert.ok(result.headers.getSetCookie().some(line => /HttpOnly/i.test(line)));
    return cookies(result);
  } finally {
    discordFetch.mock.restore();
  }
}

async function view(env, cookie) {
  const response = await getGame(env, cookie);
  assert.equal(response.status, 200);
  return response.json();
}

const guesses = ['ARARA', 'LIVRO', 'NUVEM', 'PONTE', 'CRAVO', 'BRISA', 'VENTO', 'PLANO', 'TRIGO'];

test('login via Discord libera o tabuleiro e logout encerra a sessão', async (t) => {
  const env = fixture(t);
  const cookie = await login(t, env);
  const state = await view(env, cookie);
  assert.equal(state.user.user_id, '123456789012345678');
  assert.equal(state.user.username, 'Pedro Teste');
  assert.ok(state.user.avatar);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.attempts, []);
  assert.match(state.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Date.parse(state.nextResetAt) > Date.now());

  const { onRequestPost: logout } = await import('../functions/api/auth/logout.js');
  const result = await logout({ env, request: request('/api/auth/logout', { method: 'POST', cookie }) });
  assert.equal(result.status, 204);
  assert.equal((await getGame(env, cookie)).status, 401);
});

test('tentativas persistem ao recarregar e seis erros encerram a partida', async (t) => {
  const env = fixture(t);
  const cookie = await login(t, env);
  const { date } = await view(env, cookie);
  const answer = await dailyAnswer(env, date);
  const wrong = guesses.filter(word => word !== answer);

  const invalid = await postGuess(env, cookie, { date, guess: 'AB' });
  assert.equal(invalid.status, 400);
  const expired = await postGuess(env, cookie, { date: '2000-01-01', guess: wrong[0] });
  assert.equal(expired.status, 409);
  assert.equal((await view(env, cookie)).attempts.length, 0);

  for (let index = 0; index < 6; index++) {
    const response = await postGuess(env, cookie, { date, guess: wrong[index] });
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.attempts.length, index + 1);
    assert.equal(state.attempts[index].guess, wrong[index]);
    assert.equal(state.attempts[index].marks.length, 5);
    assert.ok(state.attempts[index].marks.every(mark => ['correct', 'present', 'absent'].includes(mark)));
    assert.equal(state.status, index === 5 ? 'lost' : 'playing');
    assert.deepEqual((await view(env, cookie)).attempts, state.attempts);
    if (index < 5) assert.equal(JSON.stringify(state).includes(answer), false);
    if (index === 0) {
      const repeat = await postGuess(env, cookie, { date, guess: wrong[0] });
      assert.equal(repeat.status, 409);
      assert.equal((await view(env, cookie)).attempts.length, 1);
    }
  }

  const extra = await postGuess(env, cookie, { date, guess: wrong[6] });
  assert.equal(extra.status, 409);
  assert.equal((await view(env, cookie)).attempts.length, 6);
});

test('vitória registra a distribuição e mantém partidas separadas por conta', async (t) => {
  const env = fixture(t);
  const cookie = await login(t, env);
  const { date } = await view(env, cookie);
  const guess = await dailyAnswer(env, date);
  const response = await postGuess(env, cookie, { date, guess });
  assert.equal(response.status, 200);
  const state = await response.json();

  assert.equal(state.status, 'won');
  assert.deepEqual(state.attempts[0].marks, Array(5).fill('correct'));
  assert.equal(state.stats.played, 1);
  assert.equal(state.stats.wins, 1);
  assert.equal(state.stats.streak, 1);
  assert.equal(state.stats.best, 1);
  assert.deepEqual(state.stats.distribution, [1, 0, 0, 0, 0, 0]);

  const secondCookie = await login(t, env, '223456789012345678');
  const secondState = await view(env, secondCookie);
  assert.deepEqual(secondState.attempts, []);
  assert.equal(secondState.stats.wins, 0);
});

test('estatísticas acumulam vitórias e reiniciam a sequência quando há um dia sem vitória', async (t) => {
  const env = fixture(t);
  const cookie = await login(t, env);
  const { date, user } = await view(env, cookie);
  const winMarks = JSON.stringify(Array(5).fill('correct'));

  async function seedWin(daysAgo) {
    const day = new Date(date + 'T00:00:00Z');
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const dayKey = day.toISOString().slice(0, 10);
    await env.DB.prepare('INSERT INTO daily_words (date, answer) VALUES (?, ?)')
      .bind(dayKey, 'LIVRO').run();
    await env.DB.prepare('INSERT INTO attempts (user_id, date, position, guess, marks, is_win) VALUES (?, ?, 1, ?, ?, 1)')
      .bind(user.user_id, dayKey, 'LIVRO', winMarks).run();
  }

  for (const daysAgo of [6, 5, 4, 1]) await seedWin(daysAgo);
  const { stats } = await view(env, cookie);
  assert.equal(stats.played, 4);
  assert.equal(stats.wins, 4);
  assert.equal(stats.streak, 1);
  assert.equal(stats.best, 3);
  assert.deepEqual(stats.distribution, [4, 0, 0, 0, 0, 0]);
});
