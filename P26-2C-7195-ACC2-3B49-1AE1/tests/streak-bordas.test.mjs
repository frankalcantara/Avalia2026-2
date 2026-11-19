// Casos de borda das métricas de sequência (atual / maior) — relógio controlado, fuso America/Sao_Paulo.
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import { onRequestGet as dashboard } from '../functions/api/dashboard.js';
import { onRequestPut as toggle } from '../functions/api/habits/[id]/completions.js';
import { createSession } from '../lib/session.js';
import { computeStreaks, todayInTimeZone } from '../lib/stats.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

const ORIGIN = 'https://habits.example.com';
afterEach(() => { mock.timers.reset(); frozen = false; });

/** Fixa o relógio (instante UTC) para todo o processo de teste. */
let frozen = false;
const freeze = (iso) => {
  if (frozen) mock.timers.setTime(new Date(iso).getTime());
  else { mock.timers.enable({ apis: ['Date'], now: new Date(iso) }); frozen = true; }
};

async function setup(tz = 'America/Sao_Paulo') {
  const env = { DB: createFakeD1(), SESSION_SECRET: 's'.repeat(40), APP_TZ: tz };
  await env.DB.prepare("INSERT INTO users (id, username, display_name) VALUES ('1','u','U')").run();
  const cookie = `session=${await createSession(env.SESSION_SECRET, '1', 60 * 60 * 24 * 3650)}`;
  return { env, cookie };
}
async function habit(env, name) {
  const r = await env.DB.prepare('INSERT INTO habits (user_id, name) VALUES (?, ?)').bind('1', name).run();
  return r.meta.last_row_id;
}
async function seed(env, id, dates) {
  for (const d of dates) await env.DB.prepare('INSERT INTO completions (habit_id, date) VALUES (?, ?)').bind(id, d).run();
}
function range(start, n) {
  const [y, m, d] = start.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}
const get = async (env, cookie, month) => {
  const url = `${ORIGIN}/api/dashboard${month ? `?month=${month}` : ''}`;
  const res = await dashboard({ request: new Request(url, { headers: { Cookie: cookie } }), env });
  assert.equal(res.status, 200);
  return res.json();
};
const put = async (env, cookie, id, body) => {
  const request = new Request(`${ORIGIN}/api/habits/${id}/completions`, {
    method: 'PUT',
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return toggle({ request, env, params: { id: String(id) } });
};

test('meia-noite em São Paulo: 23:59 local ainda é o dia anterior, 00:01 local é o dia seguinte', () => {
  // 2026-11-18T02:59Z = 17/11 23:59 em SP (UTC-3); 03:01Z = 18/11 00:01 em SP.
  assert.equal(todayInTimeZone('America/Sao_Paulo', new Date('2026-11-18T02:59:00Z')), '2026-11-17');
  assert.equal(todayInTimeZone('America/Sao_Paulo', new Date('2026-11-18T03:01:00Z')), '2026-11-18');
});

test('dashboard às 23:59 locais: "hoje" é 17/11 e a sequência atual termina em 17/11', async () => {
  freeze('2026-11-18T02:59:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, ['2026-11-15', '2026-11-16', '2026-11-17']);
  const body = await get(env, cookie, '2026-11');
  assert.equal(body.today, '2026-11-17');
  assert.equal(body.habits[0].stats.currentStreak, 3);
  assert.equal(body.habits[0].stats.maxStreak, 3);
  assert.equal(body.habits[0].stats.monthEligible, 17);
});

test('virada da meia-noite local: sem marcar o dia novo a sequência segue viva (termina ontem); após 2 dias zera', async () => {
  freeze('2026-11-18T02:59:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, ['2026-11-15', '2026-11-16', '2026-11-17']);
  freeze('2026-11-18T03:01:00Z'); // 18/11 00:01 local, ainda sem marcar
  let s = (await get(env, cookie, '2026-11')).habits[0].stats;
  assert.equal(s.currentStreak, 3);
  assert.equal(s.monthEligible, 18);
  freeze('2026-11-19T03:01:00Z'); // 19/11 00:01 local: 18 inteiro sem marcação
  s = (await get(env, cookie, '2026-11')).habits[0].stats;
  assert.equal(s.currentStreak, 0);
  assert.equal(s.maxStreak, 3);
});

test('virada do mês à meia-noite local (30/11 23:59 -> 01/12 00:01): mês atual e streak acompanham', async () => {
  freeze('2026-12-01T02:59:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, ['2026-11-29', '2026-11-30']);
  freeze('2026-12-01T02:59:00Z'); // 30/11 23:59 local
  let body = await get(env, cookie);
  assert.equal(body.month, '2026-11');
  assert.equal(body.habits[0].stats.currentStreak, 2);
  freeze('2026-12-01T03:01:00Z'); // 01/12 00:01 local
  body = await get(env, cookie);
  assert.equal(body.month, '2026-12', 'mês padrão deve virar com o fuso local');
  assert.equal(body.habits[0].stats.currentStreak, 2, 'dia 01/12 ainda não marcado: sequência até 30/11 vale');
  assert.equal(body.habits[0].stats.monthEligible, 1);
  assert.equal(body.habits[0].stats.monthCompleted, 0);
  // marcar 01/12 estende a sequência através do mês
  const res = await put(env, cookie, id, { date: '2026-12-01', done: true });
  assert.equal(res.status, 200);
  const after = await res.json();
  assert.equal(after.habits[0].stats.currentStreak, 3);
  assert.equal(after.habits[0].stats.maxStreak, 3);
});

test('virada de ano à meia-noite local (31/12 -> 01/01): sequência atravessa o ano', async () => {
  freeze('2026-12-31T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, ['2026-12-30', '2026-12-31']);
  freeze('2027-01-01T03:30:00Z'); // 01/01/2027 00:30 local
  const body = await get(env, cookie);
  assert.equal(body.today, '2027-01-01');
  assert.equal(body.month, '2027-01');
  assert.equal(body.habits[0].stats.currentStreak, 2);
  const res = await put(env, cookie, id, { date: '2027-01-01', done: true });
  const s = (await res.json()).habits[0].stats;
  assert.equal(s.currentStreak, 3);
  assert.equal(s.maxStreak, 3);
});

test('fuso explícito: 23:30 em SP já é o dia seguinte em UTC, mas o servidor usa APP_TZ', async () => {
  freeze('2026-11-18T02:30:00Z'); // 17/11 23:30 SP == 18/11 02:30 UTC
  const { env, cookie } = await setup('America/Sao_Paulo');
  const id = await habit(env, 'A');
  const futuro = await put(env, cookie, id, { date: '2026-11-18', done: true });
  assert.equal(futuro.status, 400, '18/11 ainda é futuro em SP');
  const ok = await put(env, cookie, id, { date: '2026-11-17', done: true });
  assert.equal(ok.status, 200);
});

test('sequência longa cruzando vários meses e o ano (set/2025 a nov/2026) e consultas de cada mês', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  const dias = range('2025-09-01', 365 + 79); // 01/09/2025 .. 18/11/2026 (inclusive)
  assert.equal(dias.at(-1), '2026-11-18');
  await seed(env, id, dias);
  for (const month of ['2025-09', '2025-12', '2026-01', '2026-02', '2026-11']) {
    const s = (await get(env, cookie, month)).habits[0].stats;
    assert.equal(s.currentStreak, dias.length, `currentStreak em ${month}`);
    assert.equal(s.maxStreak, dias.length, `maxStreak em ${month}`);
  }
  // furo no meio: o maior continua sendo o trecho anterior ao furo
  await env.DB.prepare('DELETE FROM completions WHERE habit_id = ? AND date = ?').bind(id, '2026-01-01').run();
  const s = (await get(env, cookie, '2026-11')).habits[0].stats;
  const apos = range('2026-01-02', 321).length; // 02/01 .. 18/11
  assert.equal(s.currentStreak, apos);
  assert.equal(s.maxStreak, Math.max(apos, range('2025-09-01', 122).length));
});

test('mês passado consultado não altera a sequência atual em andamento; completedDates só do mês', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, [...range('2026-10-25', 25)]); // 25/10 .. 18/11
  const out = await get(env, cookie, '2026-10');
  const h = out.habits[0];
  assert.equal(h.stats.currentStreak, 25);
  assert.equal(h.stats.maxStreak, 25);
  assert.deepEqual(h.completedDates, range('2026-10-25', 7));
  assert.equal(h.stats.monthEligible, 31);
  assert.equal(h.stats.monthCompleted, 7);
  const nov = (await get(env, cookie, '2026-11')).habits[0];
  assert.equal(nov.stats.currentStreak, 25);
  assert.equal(nov.completedDates.length, 18);
});

test('mês futuro com sequência em andamento: completedDates vazio e taxa 0, streaks inalterados', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, range('2026-11-10', 9));
  const h = (await get(env, cookie, '2027-03')).habits[0];
  assert.deepEqual(h.completedDates, []);
  assert.equal(h.stats.monthRate, 0);
  assert.equal(h.stats.currentStreak, 9);
  assert.equal(h.stats.maxStreak, 9);
});

test('vários hábitos: indicador geral = melhor atual e melhor máximo (podem vir de hábitos diferentes)', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const a = await habit(env, 'A'); // sequência atual 2, máxima 2
  const b = await habit(env, 'B'); // sequência atual 1, máxima 10 (antiga)
  const c = await habit(env, 'C'); // sem conclusões
  await seed(env, a, ['2026-11-17', '2026-11-18']);
  await seed(env, b, [...range('2026-10-01', 10), '2026-11-18']);
  const body = await get(env, cookie, '2026-11');
  const [ha, hb, hc] = body.habits;
  assert.deepEqual([ha.stats.currentStreak, ha.stats.maxStreak], [2, 2]);
  assert.deepEqual([hb.stats.currentStreak, hb.stats.maxStreak], [1, 10]);
  assert.deepEqual([hc.stats.currentStreak, hc.stats.maxStreak, hc.stats.monthCompleted, hc.stats.monthRate], [0, 0, 0, 0]);
  assert.equal(body.overall.currentStreak, 2);
  assert.equal(body.overall.maxStreak, 10);
  assert.equal(body.overall.monthCompleted, 3);
  assert.equal(body.overall.monthEligible, 54); // 3 hábitos x 18 dias
  assert.equal(body.overall.monthRate, 5.6);
});

test('sem hábitos e hábito sem conclusões: tudo zero, sem NaN', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  let body = await get(env, cookie);
  assert.deepEqual(body.overall, { currentStreak: 0, maxStreak: 0, monthCompleted: 0, monthEligible: 0, monthRate: 0 });
  await habit(env, 'A');
  body = await get(env, cookie);
  assert.deepEqual(body.habits[0].stats, { currentStreak: 0, maxStreak: 0, monthCompleted: 0, monthEligible: 18, monthRate: 0 });
  assert.equal(JSON.stringify(body).includes('null'), false);
});

test('marcar/desmarcar o mesmo dia repetidamente é idempotente e o estado final é o último pedido', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, ['2026-11-16', '2026-11-17']);
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await put(env, cookie, id, { date: '2026-11-18', done: true })).status, 200); // repetido
  }
  let s = (await get(env, cookie, '2026-11')).habits[0];
  assert.equal(s.completedDates.filter((d) => d === '2026-11-18').length, 1);
  assert.deepEqual([s.stats.currentStreak, s.stats.maxStreak, s.stats.monthCompleted], [3, 3, 3]);
  for (let i = 0; i < 4; i += 1) {
    assert.equal((await put(env, cookie, id, { date: '2026-11-18', done: i % 2 === 0 })).status, 200);
  }
  // sequência true,false,true,false -> final desmarcado
  s = (await get(env, cookie, '2026-11')).habits[0];
  assert.deepEqual([s.stats.currentStreak, s.stats.maxStreak, s.stats.monthCompleted], [2, 2, 2]);
  // desmarcar dia que nunca foi marcado não altera nada nem dá erro
  assert.equal((await put(env, cookie, id, { date: '2026-11-01', done: false })).status, 200);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM completions').first('n');
  assert.equal(n, 2);
});

test('desmarcar um dia do meio quebra a sequência: máxima = maior trecho restante', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, range('2026-11-08', 11)); // 08..18
  const out = await (await put(env, cookie, id, { date: '2026-11-14', done: false })).json();
  const s = out.habits[0].stats;
  assert.equal(s.currentStreak, 4); // 15..18
  assert.equal(s.maxStreak, 6); // 08..13
});

test('PUT num mês passado devolve o painel desse mês, com a sequência atual global', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const id = await habit(env, 'A');
  await seed(env, id, range('2026-11-16', 3));
  const res = await put(env, cookie, id, { date: '2026-10-31', done: true });
  const body = await res.json();
  assert.equal(body.month, '2026-10');
  assert.equal(body.habits[0].stats.currentStreak, 3); // 31/10 não é vizinho de 16/11: não emenda
  assert.equal(body.habits[0].stats.maxStreak, 3);
  assert.deepEqual(body.habits[0].completedDates, ['2026-10-31']);
});

test('consistência: painel do PUT == painel de GET /api/dashboard (mesmo mês), inclusive overall', async () => {
  freeze('2026-11-18T15:00:00Z');
  const { env, cookie } = await setup();
  const a = await habit(env, 'A');
  const b = await habit(env, 'B');
  await seed(env, a, range('2026-11-10', 5));
  await seed(env, b, ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-17']);
  const passos = [
    [a, '2026-11-15', true], [a, '2026-11-16', true], [b, '2026-11-18', true], [a, '2026-11-12', false],
    [b, '2026-11-17', false], [b, '2026-11-02', true], [a, '2026-11-18', true], [a, '2026-11-18', false],
  ];
  for (const [id, date, done] of passos) {
    const fromPut = await (await put(env, cookie, id, { date, done })).json();
    const fromGet = await get(env, cookie, '2026-11');
    assert.deepEqual(fromPut, fromGet, `divergência após PUT ${id} ${date} ${done}`);
  }
});

test('computeStreaks: dia atual e anterior ausentes zeram; "today" no fim do mês/ano e em 29/02', () => {
  assert.deepEqual(computeStreaks(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01'), { maxStreak: 4, currentStreak: 4 });
  assert.deepEqual(computeStreaks(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01'), { maxStreak: 3, currentStreak: 3 });
  assert.deepEqual(computeStreaks(['2026-11-10'], '2026-11-12'), { maxStreak: 1, currentStreak: 0 });
});
