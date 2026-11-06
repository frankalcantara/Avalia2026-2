import test from 'node:test';
import assert from 'node:assert/strict';
import { sm2 } from '../functions/_lib.js';
const novo = () => ({ ease: 2.5, interval_days: 0, repetitions: 0 });
test('primeira revisão: 1, 3 e 4 dias', () => {
  assert.equal(sm2(novo(), 'dificil').interval_days, 1);
  assert.equal(sm2(novo(), 'bom').interval_days, 3);
  assert.equal(sm2(novo(), 'facil').interval_days, 4);
});
test('bom multiplica pelo ease', () => {
  assert.equal(sm2({ ease: 2.5, interval_days: 4, repetitions: 1 }, 'bom').interval_days, 10);
});
test('fácil cresce e aumenta o ease', () => {
  const r = sm2({ ease: 2.5, interval_days: 4, repetitions: 1 }, 'facil');
  assert.equal(r.interval_days, 13); assert.equal(r.ease, 2.65);
});
test('difícil reinicia e o ease nunca cai de 1.3', () => {
  const r = sm2({ ease: 1.35, interval_days: 10, repetitions: 3 }, 'dificil');
  assert.deepEqual(r, { ease: 1.3, interval_days: 1, repetitions: 0 });
});
test('rating inválido lança erro', () => assert.throws(() => sm2(novo(), 'x')));
