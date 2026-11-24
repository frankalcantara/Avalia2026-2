import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeHabitStats,
  computeMonthStats,
  computeOverall,
  computeStreaks,
  daysInMonth,
  isValidISODate,
  isValidMonth,
  todayInTimeZone,
} from '../lib/stats.js';

test('isValidISODate valida formato e calendário', () => {
  assert.equal(isValidISODate('2026-11-12'), true);
  assert.equal(isValidISODate('2024-02-29'), true);
  assert.equal(isValidISODate('2025-02-29'), false);
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(isValidISODate('2026-13-01'), false);
  assert.equal(isValidISODate('2026-1-1'), false);
  assert.equal(isValidISODate('1999-12-31'), false);
  assert.equal(isValidISODate(20261112), false);
  assert.equal(isValidISODate(null), false);
});

test('isValidMonth e daysInMonth', () => {
  assert.equal(isValidMonth('2026-11'), true);
  assert.equal(isValidMonth('2026-00'), false);
  assert.equal(isValidMonth('2026-13'), false);
  assert.equal(isValidMonth('26-11'), false);
  assert.equal(daysInMonth('2026-11'), 30);
  assert.equal(daysInMonth('2026-12'), 31);
  assert.equal(daysInMonth('2024-02'), 29);
  assert.equal(daysInMonth('2025-02'), 28);
});

test('todayInTimeZone respeita o fuso', () => {
  const instant = new Date('2026-11-13T02:30:00Z'); // 23:30 do dia 12 em São Paulo (UTC-3)
  assert.equal(todayInTimeZone('America/Sao_Paulo', instant), '2026-11-12');
  assert.equal(todayInTimeZone('UTC', instant), '2026-11-13');
});

test('streaks: sequência terminando hoje', () => {
  const r = computeStreaks(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-12');
  assert.deepEqual(r, { maxStreak: 3, currentStreak: 3 });
});

test('streak atual continua se hoje ainda não foi marcado (termina ontem)', () => {
  const r = computeStreaks(['2026-11-10', '2026-11-11'], '2026-11-12');
  assert.deepEqual(r, { maxStreak: 2, currentStreak: 2 });
});

test('streak atual zera após um dia inteiro sem marcar', () => {
  const r = computeStreaks(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-09'], '2026-11-12');
  assert.deepEqual(r, { maxStreak: 3, currentStreak: 0 });
});

test('streak máximo vem de um trecho antigo; atual é independente', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-11', '2026-11-12'];
  assert.deepEqual(computeStreaks(dates, '2026-11-12'), { maxStreak: 4, currentStreak: 2 });
});

test('streaks atravessam virada de mês e ano, e ano bissexto', () => {
  assert.deepEqual(computeStreaks(['2025-12-31', '2026-01-01'], '2026-01-01'), { maxStreak: 2, currentStreak: 2 });
  assert.deepEqual(computeStreaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01'), {
    maxStreak: 3,
    currentStreak: 3,
  });
  // 2025 não é bissexto: 28/02 e 01/03 são consecutivos
  assert.deepEqual(computeStreaks(['2025-02-28', '2025-03-01'], '2025-03-01'), { maxStreak: 2, currentStreak: 2 });
});

test('streaks ignoram duplicatas, datas inválidas e datas futuras; lista vazia = 0', () => {
  assert.deepEqual(computeStreaks(['2026-11-12', '2026-11-12'], '2026-11-12'), { maxStreak: 1, currentStreak: 1 });
  assert.deepEqual(computeStreaks(['2026-11-13', 'lixo', '2026-02-30'], '2026-11-12'), {
    maxStreak: 0,
    currentStreak: 0,
  });
  assert.deepEqual(computeStreaks([], '2026-11-12'), { maxStreak: 0, currentStreak: 0 });
});

test('taxa mensal: mês corrente usa dias decorridos', () => {
  const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-08', '2026-11-12'];
  assert.deepEqual(computeMonthStats(dates, '2026-11', '2026-11-12'), {
    monthCompleted: 5,
    monthEligible: 12,
    monthRate: 41.7,
  });
});

test('taxa mensal: mês passado = mês inteiro; mês futuro = 0; outro mês não conta', () => {
  assert.deepEqual(computeMonthStats(['2026-10-31'], '2026-10', '2026-11-12'), {
    monthCompleted: 1,
    monthEligible: 31,
    monthRate: 3.2,
  });
  assert.deepEqual(computeMonthStats(['2026-11-12'], '2026-12', '2026-11-12'), {
    monthCompleted: 0,
    monthEligible: 0,
    monthRate: 0,
  });
  assert.equal(computeMonthStats(['2026-10-05'], '2026-11', '2026-11-12').monthCompleted, 0);
});

test('taxa 100% quando todos os dias decorridos foram cumpridos', () => {
  const dates = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  assert.equal(computeMonthStats(dates, '2026-11', '2026-11-12').monthRate, 100);
});

test('computeHabitStats combina streaks e taxa; computeOverall consolida', () => {
  const a = computeHabitStats(['2026-11-11', '2026-11-12'], '2026-11', '2026-11-12');
  const b = computeHabitStats(['2026-11-01'], '2026-11', '2026-11-12');
  assert.deepEqual(a, { maxStreak: 2, currentStreak: 2, monthCompleted: 2, monthEligible: 12, monthRate: 16.7 });
  assert.deepEqual(computeOverall([a, b]), {
    currentStreak: 2,
    maxStreak: 2,
    monthCompleted: 3,
    monthEligible: 24,
    monthRate: 12.5,
  });
  assert.deepEqual(computeOverall([]), {
    currentStreak: 0,
    maxStreak: 0,
    monthCompleted: 0,
    monthEligible: 0,
    monthRate: 0,
  });
});
