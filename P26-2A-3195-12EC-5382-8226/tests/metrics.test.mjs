// Testes unitários das métricas calculadas no servidor.  Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { maxStreak, currentStreak, monthlyStats, habitMetrics, summarize } from "../src/lib/metrics.js";
import { resolveToday, elapsedDaysInMonth, daysInMonth, isValidDate, addDays } from "../src/lib/dates.js";

const TODAY = "2026-11-18";

test("maxStreak: lista vazia = 0", () => {
  assert.equal(maxStreak([], TODAY), 0);
});

test("maxStreak: encontra a maior sequência, ignorando duplicadas e fora de ordem", () => {
  const dates = ["2026-11-05", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-03", "2026-11-10", "2026-11-11"];
  assert.equal(maxStreak(dates, TODAY), 3);
});

test("maxStreak: atravessa a virada de mês e de ano", () => {
  assert.equal(maxStreak(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"], TODAY), 4);
  assert.equal(maxStreak(["2026-02-27", "2026-02-28", "2026-03-01"], TODAY), 3);
});

test("maxStreak: ignora datas futuras e inválidas", () => {
  assert.equal(maxStreak(["2026-11-18", "2026-11-19", "2026-11-20", "lixo", "2026-02-30"], TODAY), 1);
});

test("currentStreak: conta até hoje quando hoje está marcado", () => {
  assert.equal(currentStreak(["2026-11-16", "2026-11-17", "2026-11-18"], TODAY), 3);
});

test("currentStreak: hoje ainda não marcado mantém a sequência até ontem", () => {
  assert.equal(currentStreak(["2026-11-15", "2026-11-16", "2026-11-17"], TODAY), 3);
});

test("currentStreak: zera se ontem e hoje não foram marcados", () => {
  assert.equal(currentStreak(["2026-11-14", "2026-11-15", "2026-11-16"], TODAY), 0);
});

test("monthlyStats: mês corrente usa dias decorridos como base", () => {
  const dates = ["2026-11-01", "2026-11-02", "2026-11-18", "2026-10-31"];
  const s = monthlyStats(dates, "2026-11", TODAY);
  assert.deepEqual(s, { completedDays: 3, eligibleDays: 18, rate: 16.7 });
});

test("monthlyStats: mês passado usa o mês inteiro", () => {
  const dates = Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  assert.deepEqual(monthlyStats(dates, "2026-09", TODAY), { completedDays: 15, eligibleDays: 30, rate: 50 });
});

test("monthlyStats: 100% quando todos os dias decorridos foram cumpridos", () => {
  const dates = Array.from({ length: 18 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  assert.equal(monthlyStats(dates, "2026-11", TODAY).rate, 100);
});

test("habitMetrics + summarize: consolidação do painel", () => {
  const a = habitMetrics(["2026-11-17", "2026-11-18"], "2026-11", TODAY);
  const b = habitMetrics(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"], "2026-11", TODAY);
  assert.equal(a.doneToday, true);
  assert.equal(b.currentStreak, 0);
  assert.equal(b.maxStreak, 4);
  const s = summarize([a, b]);
  assert.deepEqual(s, {
    habits: 2,
    completedDays: 6,
    eligibleDays: 36,
    monthlyRate: 16.7,
    bestCurrentStreak: 2,
    bestMaxStreak: 4,
    doneToday: 1,
  });
});

test("summarize: sem hábitos não divide por zero", () => {
  assert.equal(summarize([]).monthlyRate, 0);
});

test("datas: validação, meses e anos bissextos", () => {
  assert.equal(isValidDate("2028-02-29"), true);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(elapsedDaysInMonth("2026-12", TODAY), 0);
});

test("resolveToday: aceita o 'hoje' do cliente só a até 1 dia do UTC", () => {
  const now = new Date("2026-11-18T02:00:00Z"); // 23h do dia 17 em São Paulo
  assert.equal(resolveToday("2026-11-17", now), "2026-11-17");
  assert.equal(resolveToday("2026-11-19", now), "2026-11-19");
  assert.equal(resolveToday("2030-01-01", now), "2026-11-18");
  assert.equal(resolveToday("abc", now), "2026-11-18");
  assert.equal(resolveToday(null, now), "2026-11-18");
});

test("monthlyStats: hábito criado no meio do mês não começa 'devendo' os dias anteriores", () => {
  // criado no dia 10, cumpriu 10..18 => 9/9 = 100%
  const dates = Array.from({ length: 9 }, (_, i) => `2026-11-${String(i + 10).padStart(2, "0")}`);
  assert.deepEqual(monthlyStats(dates, "2026-11", TODAY, "2026-11-10 12:00:00"), { completedDays: 9, eligibleDays: 9, rate: 100 });
  // criado hoje, sem marcações => base de 1 dia
  assert.deepEqual(monthlyStats([], "2026-11", TODAY, "2026-11-18 08:00:00"), { completedDays: 0, eligibleDays: 1, rate: 0 });
});

test("monthlyStats: marcação retroativa antes da criação recua a base (nunca passa de 100%)", () => {
  const s = monthlyStats(["2026-11-05", "2026-11-18"], "2026-11", TODAY, "2026-11-18 08:00:00");
  assert.deepEqual(s, { completedDays: 2, eligibleDays: 14, rate: 14.3 });
});

test("monthlyStats: mês anterior à criação do hábito tem base 0", () => {
  assert.deepEqual(monthlyStats([], "2026-10", TODAY, "2026-11-18 08:00:00"), { completedDays: 0, eligibleDays: 0, rate: 0 });
});
