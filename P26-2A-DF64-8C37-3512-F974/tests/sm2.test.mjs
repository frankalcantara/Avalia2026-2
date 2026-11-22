// Testes do algoritmo SM-2 simplificado e das datas (node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, preview, nextEase, isValidRating, MIN_EASE, MAX_INTERVAL } from '../functions/_lib/sm2.js';
import { addDays, diffDays, isIsoDate, todayIn, resolveTimeZone, DEFAULT_TZ } from '../functions/_lib/dates.js';

const NEW = { ease_factor: 2.5, interval_days: 0, repetitions: 0 };

test('avaliações válidas são apenas hard/good/easy', () => {
  assert.ok(isValidRating('hard'));
  assert.ok(isValidRating('good'));
  assert.ok(isValidRating('easy'));
  for (const bad of ['again', '', 'HARD', null, undefined, 3, 'toString', '__proto__']) {
    assert.equal(isValidRating(bad), false, String(bad));
  }
  assert.throws(() => schedule(NEW, 'again'), RangeError);
});

test('fator de facilidade segue a fórmula do SM-2', () => {
  assert.equal(nextEase(2.5, 5), 2.6);
  assert.equal(nextEase(2.5, 4), 2.5);
  assert.equal(nextEase(2.5, 3), 2.36);
  assert.equal(nextEase(1.3, 3), MIN_EASE, 'nunca abaixo de 1.3');
  assert.equal(nextEase(NaN, 4), 2.5, 'valor inválido usa o padrão');
});

test('primeira revisão de um cartão novo', () => {
  assert.deepEqual(schedule(NEW, 'hard'), { ease_factor: 2.36, interval_days: 1, repetitions: 1, quality: 3 });
  assert.deepEqual(schedule(NEW, 'good'), { ease_factor: 2.5, interval_days: 1, repetitions: 1, quality: 4 });
  assert.deepEqual(schedule(NEW, 'easy'), { ease_factor: 2.6, interval_days: 4, repetitions: 1, quality: 5 });
});

test('segunda revisão', () => {
  const c = { ease_factor: 2.5, interval_days: 1, repetitions: 1 };
  assert.equal(schedule(c, 'hard').interval_days, 3);
  assert.equal(schedule(c, 'good').interval_days, 6);
  assert.equal(schedule(c, 'easy').interval_days, 8);
});

test('revisões seguintes multiplicam o intervalo', () => {
  const c = { ease_factor: 2.5, interval_days: 6, repetitions: 2 };
  assert.equal(schedule(c, 'hard').interval_days, 7);       // max(7, round(6*1.2)=7)
  assert.equal(schedule(c, 'good').interval_days, 15);      // round(6*2.5)
  assert.equal(schedule(c, 'easy').interval_days, 20);      // round(6*2.6*1.3)=20.28
  assert.equal(schedule(c, 'good').repetitions, 3);
});

test('ordem dos intervalos: Difícil <= Bom <= Fácil, sempre >= 1', () => {
  for (let reps = 0; reps < 8; reps++) {
    for (const interval of [0, 1, 3, 10, 40, 200]) {
      for (const ease of [1.3, 1.8, 2.5, 3.2]) {
        const p = preview({ ease_factor: ease, interval_days: interval, repetitions: reps });
        assert.ok(p.hard >= 1);
        assert.ok(p.hard <= p.good && p.good <= p.easy, JSON.stringify({ reps, interval, ease, p }));
      }
    }
  }
});

test('intervalo cresce a cada acerto e respeita o teto', () => {
  let card = { ...NEW };
  let last = 0;
  for (let i = 0; i < 40; i++) {
    card = { ...card, ...schedule(card, 'easy') };
    assert.ok(card.interval_days >= last);
    last = card.interval_days;
  }
  assert.equal(last, MAX_INTERVAL);
});

test('Difícil repetido derruba a facilidade até o mínimo', () => {
  let card = { ...NEW };
  for (let i = 0; i < 20; i++) card = { ...card, ...schedule(card, 'hard') };
  assert.equal(card.ease_factor, MIN_EASE);
});

test('estado corrompido é tratado com segurança', () => {
  const r = schedule({ ease_factor: 'x', interval_days: -5, repetitions: -2 }, 'good');
  assert.equal(r.repetitions, 1);
  assert.equal(r.interval_days, 1);
  assert.equal(r.ease_factor, 2.5);
});

test('datas: soma de dias atravessa mês, ano e bissexto', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-11-21', '2026-12-01'), 10);
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
});

test('datas: validação ISO', () => {
  assert.ok(isIsoDate('2026-11-21'));
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(isIsoDate('21/11/2026'), false);
  assert.equal(isIsoDate(null), false);
});

test('fuso horário: "hoje" depende do fuso do estudante', () => {
  const instant = new Date('2026-11-22T01:30:00Z'); // 22h30 de 21/11 em São Paulo
  assert.equal(todayIn('America/Sao_Paulo', instant), '2026-11-21');
  assert.equal(todayIn('UTC', instant), '2026-11-22');
  assert.equal(resolveTimeZone('Fuso/Inexistente'), DEFAULT_TZ);
  assert.equal(resolveTimeZone(undefined), DEFAULT_TZ);
  assert.equal(resolveTimeZone('Europe/Lisbon'), 'Europe/Lisbon');
});
