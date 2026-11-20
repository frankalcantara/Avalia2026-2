// Teste do núcleo de cálculo — rode com: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcular, validarDisciplina } from "../public/js/calculo.js";

const base = { mediaAprovacao: 7, mediaExame: 4, mediaFinal: 5, notaMax: 10 };

test("média parcial e nota necessária nas restantes", () => {
  // P1 (peso 4) = 6 ; P2 (peso 4) pendente ; Lista (peso 2) = 10
  const r = calcular({ ...base, avaliacoes: [{ peso: 4, nota: 6 }, { peso: 4, nota: null }, { peso: 2, nota: 10 }] });
  assert.equal(r.mediaParcial, 7.33);           // (24+20)/6
  assert.equal(r.aprovacao.necessaria, 6.5);    // (70-44)/4
  assert.equal(r.aprovacao.situacao, "possivel");
  assert.equal(r.exame.necessaria, 0);          // 40-44 < 0
  assert.equal(r.exame.situacao, "garantida");
  assert.equal(r.situacao, "em_andamento");
});

test("aprovação impossível quando falta mais que a nota máxima", () => {
  const r = calcular({ ...base, avaliacoes: [{ peso: 1, nota: 0 }, { peso: 1, nota: null }] });
  assert.equal(r.aprovacao.situacao, "impossivel"); // precisa 14
  assert.equal(r.exame.necessaria, 8);
});

test("situação final e nota no exame", () => {
  const r = calcular({ ...base, avaliacoes: [{ peso: 1, nota: 5 }, { peso: 1, nota: 5 }] });
  assert.equal(r.situacao, "exame");
  assert.equal(r.notaNoExame, 5); // 2*5 - 5
  assert.equal(calcular({ ...base, avaliacoes: [{ peso: 1, nota: 8 }] }).situacao, "aprovado");
  assert.equal(calcular({ ...base, avaliacoes: [{ peso: 1, nota: 2 }] }).situacao, "reprovado");
});

test("aprovado antecipado quando a meta já está garantida", () => {
  const r = calcular({ ...base, avaliacoes: [{ peso: 9, nota: 10 }, { peso: 1, nota: null }] });
  assert.equal(r.situacao, "aprovado");
  assert.equal(r.aprovacao.situacao, "garantida");
});

test("validação rejeita dados inválidos", () => {
  const ok = { nome: "Cálculo", ...base, avaliacoes: [{ nome: "P1", tipo: "prova", peso: 1, nota: null }] };
  assert.equal(validarDisciplina(ok).ok, true);
  assert.equal(validarDisciplina({ ...ok, nome: "" }).ok, false);
  assert.equal(validarDisciplina({ ...ok, avaliacoes: [] }).ok, false);
  assert.equal(validarDisciplina({ ...ok, avaliacoes: [{ nome: "P1", tipo: "prova", peso: 0 }] }).ok, false);
  assert.equal(validarDisciplina({ ...ok, avaliacoes: [{ nome: "P1", tipo: "prova", peso: 1, nota: 11 }] }).ok, false);
  assert.equal(validarDisciplina({ ...ok, avaliacoes: [{ nome: "P1", tipo: "quiz", peso: 1 }] }).ok, false);
  assert.equal(validarDisciplina({ ...ok, mediaExame: 8 }).ok, false);
});
