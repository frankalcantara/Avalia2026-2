/**
 * Testes da fundação (Fase 1).
 * Executar com: node --test tests/
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canonicalJson,
  codigoVerificacao,
  hashCanonico,
  randomCode,
  randomInt,
  sha256Hex,
} from "../functions/_lib/crypto.js";

import {
  aplicarSwaps,
  distribuirGrupos,
  fisherYates,
  montarPayloadAta,
  montarSorteio,
  reproduzirResultado,
} from "../functions/_lib/sorteio.js";

import {
  ErroValidacao,
  chaveComparacao,
  normalizarCodigoAta,
  normalizarCodigoSala,
  validarNomes,
  validarSala,
} from "../functions/_lib/validacao.js";

const participantes = [
  { participantId: 1, userId: "u1", displayName: "Ana", source: "manual" },
  { participantId: 2, userId: "u2", displayName: "Bruno", source: "discord" },
  { participantId: 3, userId: null, displayName: "Carla", source: "manual" },
  { participantId: 4, userId: "u4", displayName: "Diego", source: "discord" },
  { participantId: 5, userId: "u5", displayName: "Elisa", source: "discord" },
];

test("canonicalJson ordena chaves e ignora undefined", () => {
  const a = canonicalJson({ b: 1, a: { d: [3, 2], c: "x" } });
  const b = canonicalJson({ a: { c: "x", d: [3, 2] }, b: 1, ignorado: undefined });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"c":"x","d":[3,2]},"b":1}');
});

test("sha256Hex bate com o vetor conhecido de 'abc'", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("randomInt respeita o intervalo e distribui sem bucket vazio", () => {
  const contagem = new Array(6).fill(0);
  for (let i = 0; i < 6000; i += 1) contagem[randomInt(6)] += 1;
  for (const total of contagem) {
    assert.ok(total > 700, `bucket com ${total} amostras — distribuição suspeita`);
  }
  assert.throws(() => randomInt(0), RangeError);
});

test("codigoVerificacao segue o formato SORT-XXXX-XXXX", () => {
  for (let i = 0; i < 50; i += 1) {
    assert.match(codigoVerificacao(), /^SORT-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  }
  assert.equal(randomCode(8).length, 8);
});

test("fisherYates devolve permutação válida e a trilha reproduz o resultado", () => {
  const { result, swaps } = fisherYates(participantes);
  assert.equal(result.length, participantes.length);
  assert.deepEqual(
    result.map((p) => p.participantId).sort((a, b) => a - b),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    aplicarSwaps(participantes, swaps).map((p) => p.participantId),
    result.map((p) => p.participantId)
  );
});

test("aplicarSwaps rejeita trilha inválida", () => {
  assert.throws(() => aplicarSwaps(participantes, [[0, 99]]), /swaps inválida/);
  assert.throws(() => aplicarSwaps(participantes, [[1, 1]]), /swaps inválida/);
});

test("distribuirGrupos mantém diferença de tamanho no máximo 1", () => {
  for (let total = 2; total <= 40; total += 1) {
    for (let tamanho = 2; tamanho <= 8; tamanho += 1) {
      const itens = Array.from({ length: total }, (_, i) => i);
      const grupos = distribuirGrupos(itens, tamanho);
      const tamanhos = grupos.map((g) => g.length);
      assert.equal(tamanhos.reduce((soma, n) => soma + n, 0), total);
      assert.ok(Math.max(...tamanhos) <= tamanho, `grupo maior que ${tamanho}`);
      assert.ok(Math.max(...tamanhos) - Math.min(...tamanhos) <= 1);
    }
  }
});

test("montarSorteio + reproduzirResultado fecham o ciclo nos dois modos", () => {
  const rng = (max) => (max - 1); // determinístico: inverte a lista
  for (const modo of ["order", "groups"]) {
    const { swaps, result } = montarSorteio({
      participantes,
      mode: modo,
      groupSize: modo === "groups" ? 2 : null,
      rng,
    });
    const payload = montarPayloadAta({
      drawId: "draw-1",
      room: { id: "sala-1", public_code: "ABCD2345", title: "Seminário" },
      seq: 1,
      participantes,
      mode: modo,
      groupSize: modo === "groups" ? 2 : null,
      swaps,
      result,
      verificationCode: "SORT-ABCD-2345",
      prevHash: null,
      createdAt: "2026-11-08T12:00:00.000Z",
      createdByUserId: "u1",
    });

    const reproduzido = reproduzirResultado(payload);
    assert.equal(reproduzido.ok, true, `replay falhou no modo ${modo}`);
    assert.equal(reproduzido.esperado.join(","), reproduzido.obtido.join(","));
  }
});

test("hash da ata muda se qualquer campo mudar", async () => {
  const base = {
    algorithm: "fisher-yates",
    algorithmVersion: 1,
    drawId: "draw-1",
    participants: [{ participantId: 1, displayName: "Ana" }],
    swaps: [[0, 0]],
    result: { mode: "order", order: [{ position: 1, participantId: 1 }] },
  };
  const h1 = await hashCanonico(base);
  const h2 = await hashCanonico({ ...base, drawId: "draw-2" });
  const h3 = await hashCanonico({ ...base, participants: [{ participantId: 1, displayName: "Bia" }] });
  assert.notEqual(h1, h2);
  assert.notEqual(h1, h3);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("validarSala aceita payload válido e normaliza campos", () => {
  assert.deepEqual(validarSala({ title: "  Trabalho   de LP  ", mode: "groups", groupSize: "3" }), {
    title: "Trabalho de LP",
    mode: "groups",
    groupSize: 3,
    allowJoin: true,
  });
  assert.deepEqual(validarSala({ title: "Apresentação", mode: "order", allowJoin: false }), {
    title: "Apresentação",
    mode: "order",
    groupSize: null,
    allowJoin: false,
  });
});

test("validarSala rejeita modo, título e tamanho inválidos", () => {
  assert.throws(() => validarSala({ title: "ab", mode: "groups", groupSize: 3 }), ErroValidacao);
  assert.throws(() => validarSala({ title: "Turma", mode: "x" }), ErroValidacao);
  assert.throws(() => validarSala({ title: "Turma", mode: "groups", groupSize: 1 }), ErroValidacao);
  assert.throws(() => validarSala({ title: "Turma", mode: "groups", groupSize: 51 }), ErroValidacao);
  assert.throws(() => validarSala({ title: "Turma", mode: "groups", groupSize: 2.5 }), ErroValidacao);
});

test("validarNomes detecta duplicados por acento/caixa e ignora linhas vazias", () => {
  assert.throws(
    () => validarNomes({ texto: "Ana\n\nANA\nJosé\njose\n  Bia  " }),
    /duplicados/i
  );
  const { nomes } = validarNomes({ texto: "\nAna\n\nBruno\n  " });
  assert.deepEqual(nomes, ["Ana", "Bruno"]);
});

test("validarNomes rejeita duplicados contra a lista existente", () => {
  assert.throws(
    () => validarNomes({ nomes: ["Ana", "Bruno"] }, ["ana"]),
    /duplicados/i
  );
});

test("validarNomes rejeita excesso e nome fora do limite", () => {
  const muitos = Array.from({ length: 201 }, (_, i) => `Aluno ${i}`);
  assert.throws(() => validarNomes({ nomes: muitos }), /limite/i);
  assert.throws(() => validarNomes({ nomes: ["A"] }), ErroValidacao);
  assert.throws(() => validarNomes({ nomes: ["x".repeat(61)] }), ErroValidacao);
});

test("normalização de códigos", () => {
  assert.equal(normalizarCodigoSala(" abcd2345 "), "ABCD2345");
  assert.throws(() => normalizarCodigoSala("ab"), ErroValidacao);
  assert.equal(normalizarCodigoAta(" sort-abcd-2345 "), "SORT-ABCD-2345");
  assert.throws(() => normalizarCodigoAta("SORT-1234"), ErroValidacao);
});

test("chaveComparacao ignora acentos e caixa", () => {
  assert.equal(chaveComparacao("  João   da Silva "), "joao da silva");
});
