// Testes unitários das regras puras de enquete (functions/_lib/polls.js).
// Executar: node --test tests/unit.test.mjs   (zero dependências)
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validatePollInput, buildResults } from "../functions/_lib/polls.js";

const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const iso = (ms) => new Date(ms).toISOString();

const valido = (extra = {}) => ({
  title: "Qual dia para a reunião?",
  description: "Contexto",
  closes_at: iso(NOW + DAY),
  options: ["Segunda", "Terça"],
  ...extra,
});

describe("validatePollInput", () => {
  test("aceita enquete válida e normaliza com trim", () => {
    const r = validatePollInput(valido({ title: "  Título ok  ", options: [" A ", "B"] }), NOW);
    assert.equal(r.ok, true);
    assert.equal(r.value.title, "Título ok");
    assert.deepEqual(r.value.options, ["A", "B"]);
    assert.equal(r.value.closesAt, NOW + DAY);
  });

  test("rejeita corpo ausente, array ou não objeto", () => {
    for (const b of [null, undefined, [], "x", 1]) assert.equal(validatePollInput(b, NOW).ok, false);
  });

  test("título: 2 caracteres falha, 3 passa, 120 passa, 121 falha", () => {
    assert.equal(validatePollInput(valido({ title: "ab" }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ title: "   ab   " }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ title: "abc" }), NOW).ok, true);
    assert.equal(validatePollInput(valido({ title: "a".repeat(120) }), NOW).ok, true);
    assert.equal(validatePollInput(valido({ title: "a".repeat(121) }), NOW).ok, false);
    assert.match(validatePollInput(valido({ title: "ab" }), NOW).message, /^title:/);
  });

  test("título não texto falha", () => {
    assert.equal(validatePollInput(valido({ title: 123 }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ title: undefined }), NOW).ok, false);
  });

  test("descrição: ausente vira vazia, 1000 passa, 1001 falha, não texto falha", () => {
    const sem = valido();
    delete sem.description;
    assert.equal(validatePollInput(sem, NOW).value.description, "");
    assert.equal(validatePollInput(valido({ description: "d".repeat(1000) }), NOW).ok, true);
    assert.equal(validatePollInput(valido({ description: "d".repeat(1001) }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ description: 5 }), NOW).ok, false);
  });

  test("prazo no passado falha", () => {
    const r = validatePollInput(valido({ closes_at: iso(NOW - MIN) }), NOW);
    assert.equal(r.ok, false);
    assert.match(r.message, /^closes_at:/);
  });

  test("prazo: menos de 5 min falha, exatamente 5 min passa", () => {
    assert.equal(validatePollInput(valido({ closes_at: iso(NOW + 5 * MIN - 1000) }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ closes_at: iso(NOW + 5 * MIN) }), NOW).ok, true);
  });

  test("prazo: 365 dias passa, 366 dias falha", () => {
    assert.equal(validatePollInput(valido({ closes_at: iso(NOW + 365 * DAY) }), NOW).ok, true);
    assert.equal(validatePollInput(valido({ closes_at: iso(NOW + 366 * DAY) }), NOW).ok, false);
  });

  test("prazo inválido, vazio ou numérico falha", () => {
    for (const c of ["amanhã", "", "   ", NOW + DAY, null]) {
      assert.equal(validatePollInput(valido({ closes_at: c }), NOW).ok, false, String(c));
    }
  });

  test("opções: 1 opção falha, 2 passa, 10 passa, 11 falha", () => {
    const n = (k) => Array.from({ length: k }, (_, i) => `Opção ${i + 1}`);
    assert.equal(validatePollInput(valido({ options: n(1) }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ options: n(2) }), NOW).ok, true);
    assert.equal(validatePollInput(valido({ options: n(10) }), NOW).ok, true);
    const r = validatePollInput(valido({ options: n(11) }), NOW);
    assert.equal(r.ok, false);
    assert.match(r.message, /^options:/);
  });

  test("opções repetidas (sem diferenciar maiúsculas e com espaços) falham", () => {
    assert.equal(validatePollInput(valido({ options: ["Sim", "sim"] }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ options: ["Sim", "  SIM "] }), NOW).ok, false);
  });

  test("opção vazia, longa ou não texto falha; 100 caracteres passa", () => {
    assert.equal(validatePollInput(valido({ options: ["A", "   "] }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ options: ["A", "b".repeat(101)] }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ options: ["A", "b".repeat(100)] }), NOW).ok, true);
    assert.equal(validatePollInput(valido({ options: ["A", 2] }), NOW).ok, false);
    assert.equal(validatePollInput(valido({ options: "A,B" }), NOW).ok, false);
  });
});

describe("buildResults", () => {
  const opts = [{ id: 10, label: "A" }, { id: 11, label: "B" }, { id: 12, label: "C" }];
  const soma = (r) => r.options.reduce((s, o) => s + o.percent, 0);

  test("sem votos: total 0 e percentuais 0", () => {
    const r = buildResults(opts, []);
    assert.equal(r.total_votes, 0);
    assert.deepEqual(r.options.map((o) => o.percent), [0, 0, 0]);
    assert.deepEqual(r.options.map((o) => o.votes), [0, 0, 0]);
  });

  test("lista de contagens do D1, preservando ordem das opções", () => {
    const r = buildResults(opts, [{ option_id: 12, votes: 2 }, { option_id: 10, votes: 3 }]);
    assert.equal(r.total_votes, 5);
    assert.deepEqual(r.options, [
      { id: 10, label: "A", votes: 3, percent: 60 },
      { id: 11, label: "B", votes: 0, percent: 0 },
      { id: 12, label: "C", votes: 2, percent: 40 },
    ]);
  });

  test("1/3 de cada: uma casa decimal e soma aproximadamente 100", () => {
    const r = buildResults(opts, { 10: 1, 11: 1, 12: 1 });
    assert.deepEqual(r.options.map((o) => o.percent), [33.3, 33.3, 33.3]);
    assert.ok(Math.abs(soma(r) - 100) <= 0.2);
  });

  test("2/3 e 1/3 arredondam para 66.7 e 33.3", () => {
    const r = buildResults(opts.slice(0, 2), new Map([[10, 2], [11, 1]]));
    assert.deepEqual(r.options.map((o) => o.percent), [66.7, 33.3]);
    assert.ok(Math.abs(soma(r) - 100) <= 0.1);
  });

  test("percentuais com no máximo 1 casa decimal e soma próxima de 100 (7 votos)", () => {
    const r = buildResults(opts, [{ option_id: 10, votes: 4 }, { option_id: 11, votes: 2 }, { option_id: 12, votes: 1 }]);
    for (const o of r.options) assert.equal(Math.round(o.percent * 10) / 10, o.percent);
    assert.ok(Math.abs(soma(r) - 100) <= 0.2);
  });

  test("contagens de opções desconhecidas e chaves em texto são tratadas", () => {
    const r = buildResults(opts, [{ option_id: "10", votes: "1" }, { option_id: 999, votes: 5 }]);
    assert.equal(r.total_votes, 1);
    assert.equal(r.options[0].percent, 100);
  });

  test("entradas vazias não quebram", () => {
    assert.deepEqual(buildResults(null, null), { total_votes: 0, options: [] });
  });
});
