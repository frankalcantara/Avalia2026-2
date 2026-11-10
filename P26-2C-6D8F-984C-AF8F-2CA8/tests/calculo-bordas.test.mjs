// Casos de borda do cálculo/validação (agente de teste) — node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcular, validarDisciplina } from "../public/js/calculo.js";

const base = { mediaAprovacao: 7, mediaExame: 4, mediaFinal: 5, notaMax: 10 };
const disc = (avaliacoes, extra = {}) => ({ nome: "X", ...base, ...extra, avaliacoes });

test("todas pendentes: média parcial null, garantida 0, máxima = notaMax", () => {
  const r = calcular({ ...base, avaliacoes: [{ peso: 2, nota: null }, { peso: 3, nota: null }] });
  assert.equal(r.mediaParcial, null);
  assert.equal(r.mediaGarantida, 0);
  assert.equal(r.mediaMaxima, 10);
  assert.equal(r.pesoLancado, 0);
  assert.deepEqual(r.aprovacao, { necessaria: 7, situacao: "possivel" });
  assert.deepEqual(r.exame, { necessaria: 4, situacao: "possivel" });
  assert.equal(r.situacao, "em_andamento");
});

test("sem avaliações não quebra (divisão por zero)", () => {
  const r = calcular({ ...base, avaliacoes: [] });
  assert.equal(r.mediaParcial, null);
  assert.equal(r.mediaGarantida, 0);
  assert.equal(r.situacao, "em_andamento"); // F5 corrigido: sem avaliações não "aprova"
});

test("pesos decimais (0.1 + 0.2) somam sem erro de ponto flutuante visível", () => {
  const r = calcular({ ...base, avaliacoes: [{ peso: 0.1, nota: 10 }, { peso: 0.2, nota: 4 }, { peso: 0.7, nota: null }] });
  assert.equal(r.pesoTotal, 1);
  assert.equal(r.pesoLancado, 0.3);
  assert.equal(r.mediaParcial, 6);                 // (1+0.8)/0.3
  assert.equal(r.aprovacao.necessaria, 7.43);      // (7-1.8)/0.7
  assert.equal(r.aprovacao.situacao, "possivel");
  const fim = calcular({ ...base, avaliacoes: [{ peso: 0.1, nota: 7 }, { peso: 0.2, nota: 7 }] });
  assert.equal(fim.situacao, "aprovado");           // 7 exato com pesos decimais
});

test("nota máxima 100", () => {
  const b = { mediaAprovacao: 70, mediaExame: 40, mediaFinal: 50, notaMax: 100 };
  const r = calcular({ ...b, avaliacoes: [{ peso: 1, nota: 60 }, { peso: 1, nota: null }] });
  assert.equal(r.aprovacao.necessaria, 80);
  assert.equal(r.aprovacao.situacao, "possivel");
  assert.equal(r.mediaMaxima, 80);
  const imp = calcular({ ...b, avaliacoes: [{ peso: 3, nota: 0 }, { peso: 1, nota: null }] });
  assert.equal(imp.aprovacao.situacao, "impossivel"); // precisaria 280
  const ex = calcular({ ...b, avaliacoes: [{ peso: 1, nota: 45 }] });
  assert.equal(ex.situacao, "exame");
  assert.equal(ex.notaNoExame, 55);
  assert.equal(validarDisciplina(disc([{ nome: "P", tipo: "prova", peso: 1, nota: 100 }], b)).ok, true);
  assert.equal(validarDisciplina(disc([{ nome: "P", tipo: "prova", peso: 1, nota: 100.01 }], b)).ok, false);
});

test("fronteiras exatas: média igual à meta conta como atingida", () => {
  assert.equal(calcular({ ...base, avaliacoes: [{ peso: 1, nota: 7 }] }).situacao, "aprovado");
  assert.equal(calcular({ ...base, avaliacoes: [{ peso: 1, nota: 4 }] }).situacao, "exame");
  assert.equal(calcular({ ...base, avaliacoes: [{ peso: 1, nota: 3.99 }] }).situacao, "reprovado");
  // precisa exatamente notaMax na restante => possível, não impossível
  const r = calcular({ ...base, avaliacoes: [{ peso: 1, nota: 4 }, { peso: 1, nota: null }] });
  assert.equal(r.aprovacao.necessaria, 10);
  assert.equal(r.aprovacao.situacao, "possivel");
});

test("exame: nota necessária pode passar da nota máxima (sinalizado no front)", () => {
  const r = calcular({ ...base, mediaFinal: 8, avaliacoes: [{ peso: 1, nota: 4 }] });
  assert.equal(r.situacao, "exame");
  assert.equal(r.notaNoExame, 12); // 2·8 − 4 > notaMax
});

test("F3 corrigido: média 6,996 não é arredondada para aprovar", () => {
  const r = calcular({ ...base, avaliacoes: [{ peso: 1, nota: 7 }, { peso: 1, nota: 6.992 }] });
  assert.equal(r.mediaGarantida, 7); // exibição arredonda
  assert.equal(r.situacao, "exame"); // decisão usa o valor exato
});

test("validação: limites de quantidade, nomes e tipos", () => {
  const av = (i) => ({ nome: `A${i}`, tipo: "lista", peso: 1, nota: null });
  assert.equal(validarDisciplina(disc(Array.from({ length: 30 }, (_, i) => av(i)))).ok, true);
  assert.equal(validarDisciplina(disc(Array.from({ length: 31 }, (_, i) => av(i)))).ok, false);
  assert.equal(validarDisciplina(disc([av(1)], { nome: "   " })).ok, false);
  assert.equal(validarDisciplina(disc([av(1)], { nome: "x".repeat(81) })).ok, false);
  assert.equal(validarDisciplina(disc([av(1)], { nome: "x".repeat(80) })).ok, true);
  assert.equal(validarDisciplina(disc([{ ...av(1), nome: "y".repeat(61) }])).ok, false);
  assert.equal(validarDisciplina(disc([{ ...av(1), tipo: "PROVA" }])).ok, false);
  assert.equal(validarDisciplina(disc([{ ...av(1), peso: -1 }])).ok, false);
  assert.equal(validarDisciplina(disc([{ ...av(1), peso: "abc" }])).ok, false);
  assert.equal(validarDisciplina(disc([{ ...av(1), peso: Infinity }])).ok, false);
  assert.equal(validarDisciplina(disc([{ ...av(1), nota: -0.01 }])).ok, false);
  assert.equal(validarDisciplina(disc([{ ...av(1), nota: "NaN" }])).ok, false);
  assert.equal(validarDisciplina(null).ok, false);
  assert.equal(validarDisciplina(disc("nao-array")).ok, false);
  assert.equal(validarDisciplina(disc([null])).ok, false);
});

test("validação normaliza strings numéricas e nota vazia", () => {
  const v = validarDisciplina(disc([{ nome: " P1 ", tipo: "prova", peso: "2.5", nota: "" }], { notaMax: "10" }));
  assert.equal(v.ok, true);
  assert.deepEqual(v.valor.avaliacoes[0], { nome: "P1", tipo: "prova", peso: 2.5, nota: null });
  assert.equal(v.valor.notaMax, 10);
});

test("validação: regras fora da faixa", () => {
  const av = [{ nome: "P", tipo: "prova", peso: 1 }];
  assert.equal(validarDisciplina(disc(av, { notaMax: 0 })).ok, false);
  assert.equal(validarDisciplina(disc(av, { notaMax: 1001 })).ok, false);
  assert.equal(validarDisciplina(disc(av, { mediaAprovacao: 11 })).ok, false);
  assert.equal(validarDisciplina(disc(av, { mediaFinal: -1 })).ok, false);
  assert.equal(validarDisciplina(disc(av, { mediaExame: 7, mediaAprovacao: 7 })).ok, true);
});

test("F4 corrigido: tipos não numéricos são rejeitados", () => {
  const av = (nota) => disc([{ nome: "P", tipo: "prova", peso: 1, nota }]);
  assert.equal(validarDisciplina(av(true)).ok, false);
  assert.equal(validarDisciplina(av([])).ok, false);
  assert.equal(validarDisciplina(av("  ")).valor?.avaliacoes[0].nota, null); // string vazia = sem nota
});
