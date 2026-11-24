import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarDay } from '../lib/dates.js';

test('devoluções usam o dia de São Paulo durante a virada do dia em UTC', () => {
  const now = new Date('2026-11-14T01:00:00Z');
  assert.equal(calendarDay(0, now), '2026-11-13');
  assert.equal(calendarDay(1, now), '2026-11-14');
  assert.equal(calendarDay(0, new Date('2026-11-14T03:00:00Z')), '2026-11-14');
});

test('prazo de devolução atravessa mês e ano corretamente', () => {
  assert.equal(calendarDay(1, new Date('2026-12-31T15:00:00Z')), '2027-01-01');
  assert.equal(calendarDay(1, new Date('2028-02-28T15:00:00Z')), '2028-02-29');
});
