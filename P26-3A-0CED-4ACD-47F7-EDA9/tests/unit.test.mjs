// Testes unitários da lógica do servidor (node:test, sem dependências)
// Uso: node --test tests/unit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeWord } from "../src/normalize.js";
import { letterFeedback, countFeedback, computeFeedback, isWinningFeedback } from "../src/feedback.js";
import { today, isValidDate, daysBetween, addDays, resolveGameDate } from "../src/dates.js";
import { isValidWord, displayOf, answerKeys } from "../src/dictionary.js";
import { slotFor, getDailyWord } from "../src/words.js";
import { ANSWERS } from "../src/data/answers.js";
import { VALID } from "../src/data/valid.js";
import { LAUNCH_DATE, RECENT_SLOTS_BLOCK } from "../src/config.js";

// ---------- Normalização ----------
test("normalização: acentos, cedilha e caixa", () => {
  assert.equal(normalizeWord("limão"), "LIMAO");
  assert.equal(normalizeWord("AÇÚCA"), "ACUCA");
  assert.equal(normalizeWord("caçar"), "CACAR");
  assert.equal(normalizeWord("Pêssê"), "PESSE");
  assert.equal(normalizeWord("CaRrO"), "CARRO");
  assert.equal(normalizeWord("  carro "), "CARRO");
});

test("normalização: rejeita tamanho errado, números, símbolos e tipos não-texto", () => {
  for (const bad of ["casa", "carros", "c4rro", "car o", "car-o", "", "😀😀😀😀😀", "carrö1"]) {
    assert.equal(normalizeWord(bad), null, `deveria rejeitar ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, 12345, ["CARRO"], { a: 1 }]) assert.equal(normalizeWord(bad), null);
});

// ---------- Feedback clássico ----------
test("feedback clássico: letras repetidas (resposta CASCA, chute ACASO)", () => {
  // C A S C A x A C A S O: A(0) present, C(1) present, A(2) present, S(3) present, O absent
  assert.deepEqual(letterFeedback("CASCA", "ACASO"), ["present", "present", "present", "present", "absent"]);
});

test("feedback clássico: correct tem prioridade sobre present com repetição", () => {
  // resposta CARRO, chute RARRR: R(2),R(3) corretos; não sobra R para os outros
  assert.deepEqual(letterFeedback("CARRO", "RARRR"), ["absent", "correct", "correct", "correct", "absent"]);
  // resposta ABBEY-like: LIVRO x OVOOO -> só um O na resposta, na posição 4
  assert.deepEqual(letterFeedback("LIVRO", "OVOOO"), ["absent", "present", "absent", "absent", "correct"]);
  // letra repetida no chute com uma só na resposta: só a primeira vira present
  assert.deepEqual(letterFeedback("PRAIA", "AAXXX"), ["present", "present", "absent", "absent", "absent"]);
  assert.deepEqual(letterFeedback("TEMPO", "OOOOO"), ["absent", "absent", "absent", "absent", "correct"]);
});

test("feedback clássico: acerto total e nenhuma letra", () => {
  assert.deepEqual(letterFeedback("CARRO", "CARRO"), Array(5).fill("correct"));
  assert.deepEqual(letterFeedback("CARRO", "MUITE"), Array(5).fill("absent"));
  assert.equal(isWinningFeedback("letters", letterFeedback("CARRO", "CARRO")), true);
  assert.equal(isWinningFeedback("letters", letterFeedback("CARRO", "CARRA")), false);
});

// ---------- Feedback sombra ----------
test("feedback sombra: contagens coerentes com o clássico", () => {
  assert.deepEqual(countFeedback("CASCA", "ACASO"), { exact: 0, misplaced: 4 });
  assert.deepEqual(countFeedback("CARRO", "RARRR"), { exact: 3, misplaced: 0 });
  assert.deepEqual(countFeedback("CARRO", "CARRO"), { exact: 5, misplaced: 0 });
  assert.equal(isWinningFeedback("counts", { exact: 5, misplaced: 0 }), true);
  assert.equal(isWinningFeedback("counts", { exact: 4, misplaced: 1 }), false);
  assert.deepEqual(computeFeedback("counts", "PRAIA", "AAXXX"), { exact: 0, misplaced: 2 });
  assert.deepEqual(computeFeedback("letters", "PRAIA", "PRAIA"), Array(5).fill("correct"));
});

test("feedback sombra: coerência com o clássico em pares aleatórios do dicionário", () => {
  const keys = answerKeys();
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++) {
    const a = keys[Math.floor(rnd() * keys.length)];
    const g = keys[Math.floor(rnd() * keys.length)];
    const l = letterFeedback(a, g);
    const c = countFeedback(a, g);
    assert.equal(c.exact, l.filter((x) => x === "correct").length);
    assert.equal(c.misplaced, l.filter((x) => x === "present").length);
    assert.ok(c.exact + c.misplaced <= 5);
    // simetria do total de letras em comum (multiconjunto)
    assert.equal(c.exact + c.misplaced, countFeedback(g, a).exact + countFeedback(g, a).misplaced);
  }
});

// ---------- Datas ----------
test("datas: hoje no fuso America/Sao_Paulo", () => {
  // 02:30 UTC de 16/11 ainda é 15/11 em Brasília (UTC-3)
  assert.equal(today(new Date("2026-11-16T02:30:00Z")), "2026-11-15");
  assert.equal(today(new Date("2026-11-16T03:00:00Z")), "2026-11-16");
  assert.equal(today(new Date("2026-01-01T02:59:59Z")), "2025-12-31");
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test("datas: validação de formato e datas impossíveis", () => {
  assert.equal(isValidDate("2026-11-15"), true);
  assert.equal(isValidDate("2028-02-29"), true);
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-5", "15/11/2026", "2026-11-15T00:00", "", null, 20261115]) {
    assert.equal(isValidDate(bad), false, `deveria rejeitar ${bad}`);
  }
});

test("datas: diferença de dias e soma", () => {
  assert.equal(daysBetween("2026-11-01", "2026-11-01"), 0);
  assert.equal(daysBetween("2026-11-01", "2026-11-15"), 14);
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(daysBetween("2027-03-01", "2027-02-28"), -1);
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
});

test("datas: resolveGameDate (vazia, inválida, antes do lançamento, futura)", () => {
  const now = new Date("2026-11-15T15:00:00Z");
  assert.equal(resolveGameDate(undefined, now), "2026-11-15");
  assert.equal(resolveGameDate("", now), "2026-11-15");
  assert.equal(resolveGameDate(null, now), "2026-11-15");
  assert.equal(resolveGameDate("2026-11-01", now), "2026-11-01");
  assert.equal(resolveGameDate("2026-11-15", now), "2026-11-15");
  const err = (fn) => { try { fn(); } catch (e) { return { status: e.status, code: e.code }; } return null; };
  assert.deepEqual(err(() => resolveGameDate("2026-11-16", now)), { status: 403, code: "future_date" });
  assert.deepEqual(err(() => resolveGameDate("2026-10-31", now)), { status: 400, code: "before_launch" });
  assert.deepEqual(err(() => resolveGameDate("2026-02-30", now)), { status: 400, code: "invalid_date" });
  assert.deepEqual(err(() => resolveGameDate(12, now)), { status: 400, code: "invalid_date" });
});

// ---------- Listas de palavras ----------
test("listas: tamanho 5, sem duplicatas, respostas contidas nas válidas, COFRE fora", () => {
  const valid = VALID.split(" ");
  assert.ok(valid.length > 5000);
  assert.equal(new Set(valid).size, valid.length, "VALID com duplicatas");
  assert.ok(valid.every((w) => /^[A-Z]{5}$/.test(w)), "VALID fora do padrão");
  const keys = ANSWERS.map((w) => normalizeWord(w));
  assert.ok(keys.every(Boolean), "ANSWERS com palavra que não normaliza para 5 letras");
  assert.equal(new Set(keys).size, keys.length, "ANSWERS com duplicatas após normalização");
  const validSet = new Set(valid);
  assert.deepEqual(keys.filter((k) => !validSet.has(k)), [], "ANSWERS fora de VALID");
  assert.ok(!keys.includes("COFRE"), "COFRE está em ANSWERS");
  assert.ok(ANSWERS.every((w) => w === w.toUpperCase()));
});

test("dicionário: validação e forma de exibição com acento", () => {
  assert.equal(isValidWord("CARRO"), true);
  assert.equal(isValidWord("ZZZZZ"), false);
  assert.equal(isValidWord("COFRE"), true, "COFRE deve ser chute aceito mesmo fora das respostas");
  const comAcento = ANSWERS.find((w) => normalizeWord(w) !== w);
  assert.ok(comAcento, "nenhuma resposta acentuada para testar");
  assert.equal(displayOf(normalizeWord(comAcento)), comAcento);
  assert.equal(answerKeys().length, ANSWERS.length);
});

// ---------- Sorteio (com D1 simulado em memória) ----------
function fakeEnv(secret) {
  const rows = new Map();
  const DB = {
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...a) { return { ...stmt, args: a }; },
        async all() {
          if (/FROM daily_words ORDER BY slot/.test(sql)) return { results: [...rows.values()].sort((a, b) => a.slot - b.slot) };
          throw new Error("SQL não simulado: " + sql);
        },
        async first() {
          if (/FROM daily_words WHERE slot = \?/.test(sql)) {
            const r = rows.get(this.args[0]);
            return r ? { word_key: r.word_key } : null;
          }
          throw new Error("SQL não simulado: " + sql);
        },
        async run() {
          const [slot, mode, day, word_key, cycle] = this.args;
          if (!rows.has(slot)) rows.set(slot, { slot, mode, day, word_key, cycle });
        },
      };
      return stmt;
    },
    async batch(stmts) { for (const s of stmts) await s.run(); },
  };
  return { DB, WORD_SECRET: secret, rows };
}

test("sorteio: slot = 2n (clássico) e 2n+1 (sombra)", () => {
  assert.equal(slotFor("classico", LAUNCH_DATE), 0);
  assert.equal(slotFor("sombra", LAUNCH_DATE), 1);
  assert.equal(slotFor("classico", "2026-11-15"), 28);
  assert.equal(slotFor("sombra", "2026-11-15"), 29);
});

test("sorteio: determinístico pelo segredo, materializa só até o alvo, sem repetição recente", async () => {
  const a = fakeEnv("segredo-a");
  const b = fakeEnv("segredo-a");
  const c = fakeEnv("segredo-b");
  const wa = await getDailyWord(a, "sombra", "2026-11-15");
  const wb = await getDailyWord(b, "sombra", "2026-11-15");
  assert.equal(wa, wb, "mesmo segredo deve gerar a mesma palavra");
  assert.equal(Math.max(...a.rows.keys()), 29, "não pode materializar além do slot alvo");
  assert.equal(a.rows.size, 30);
  const wordsA = [...a.rows.values()].sort((x, y) => x.slot - y.slot).map((r) => r.word_key);
  const wordsC = [];
  for (let d = LAUNCH_DATE; d <= "2026-11-15"; d = addDays(d, 1)) {
    wordsC.push(await getDailyWord(c, "classico", d), await getDailyWord(c, "sombra", d));
  }
  assert.notDeepEqual(wordsA, wordsC, "segredos diferentes deveriam dar ordens diferentes");
  assert.equal(new Set(wordsA).size, wordsA.length, "repetição dentro do ciclo");
  assert.ok(wordsA.every((w) => answerKeys().includes(w)));
  // clássico e sombra do mesmo dia diferentes
  for (let i = 0; i < wordsA.length; i += 2) assert.notEqual(wordsA[i], wordsA[i + 1]);
  // relê sem rematerializar e mantém a palavra
  assert.equal(await getDailyWord(a, "sombra", "2026-11-15"), wa);
});

test("sorteio: ciclo longo sem repetição nos últimos 30 slots", async () => {
  const env = fakeEnv("ciclo-longo");
  const total = answerKeys().length;
  const target = total + 200; // passa da virada de ciclo
  const day = addDays(LAUNCH_DATE, Math.floor(target / 2));
  await getDailyWord(env, "classico", day);
  const seq = [...env.rows.values()].sort((x, y) => x.slot - y.slot).map((r) => r.word_key);
  assert.equal(new Set(seq.slice(0, total)).size, total, "primeiro ciclo deve usar todas as palavras uma vez");
  for (let i = 0; i < seq.length; i++) {
    const recent = seq.slice(Math.max(0, i - RECENT_SLOTS_BLOCK), i);
    assert.ok(!recent.includes(seq[i]), `palavra repetida em menos de ${RECENT_SLOTS_BLOCK} slots no slot ${i}`);
  }
});

test("sorteio: sem WORD_SECRET responde 500 server_misconfigured", async () => {
  const env = fakeEnv(undefined);
  await assert.rejects(() => getDailyWord(env, "classico", LAUNCH_DATE), (e) => e.status === 500 && e.code === "server_misconfigured");
});
