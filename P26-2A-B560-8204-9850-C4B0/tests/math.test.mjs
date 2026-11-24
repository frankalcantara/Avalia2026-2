import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Definir window ANTES de importar o módulo para que ele exponha ReceitasMath
globalThis.window = globalThis.window || {};

import * as math from "../public/receitas-math.js";

describe("Escalonador de Porções (public/receitas-math.js)", () => {

  it("escalarQuantidade(200, 2, 5) === 500", () => {
    assert.equal(math.escalarQuantidade(200, 2, 5), 500);
  });

  it("escalarQuantidade(1, 3, 2) ≈ 0.6667 (arredondado a 4 casas)", () => {
    const result = math.escalarQuantidade(1, 3, 2);
    assert.equal(result, 0.6667);
  });

  it("escalarQuantidade(0.5, 4, 1) === 0.125", () => {
    assert.equal(math.escalarQuantidade(0.5, 4, 1), 0.125);
  });

  it("escalarQuantidade com base/alvo inválidos retorna 0", () => {
    assert.equal(math.escalarQuantidade(100, 0, 5), 0);
    assert.equal(math.escalarQuantidade(100, -1, 5), 0);
    assert.equal(math.escalarQuantidade(100, 2, 0), 0);
    assert.equal(math.escalarQuantidade(100, 2, -1), 0);
    assert.equal(math.escalarQuantidade(NaN, 2, 5), 0);
    assert.equal(math.escalarQuantidade(100, NaN, 5), 0);
    assert.equal(math.escalarQuantidade(100, 2, NaN), 0);
    assert.equal(math.escalarQuantidade(Infinity, 2, 5), 0);
  });

  it("formatarQuantidade pt-BR", () => {
    assert.equal(math.formatarQuantidade(0.6667), "0,67");
    assert.equal(math.formatarQuantidade(500), "500");
    assert.equal(math.formatarQuantidade(1000.5), "1.000,5");
    assert.equal(math.formatarQuantidade(1234.567), "1.234,57");
    assert.equal(math.formatarQuantidade(0), "0");
    assert.equal(math.formatarQuantidade(-1), "0");
  });

  it("proporcionalidade: f(x*2) = 2*f(x)", () => {
    const base = 200;
    const r1 = math.escalarQuantidade(base, 2, 5);
    const r2 = math.escalarQuantidade(base * 2, 2, 5);
    assert.equal(r2, 2 * r1);
  });

  it("ida-e-volta recompõe valor original (sem acumular erro)", () => {
    const original = 200;
    const scaled = math.escalarQuantidade(original, 2, 5);
    const back = math.escalarQuantidade(scaled, 5, 2);
    assert.equal(back, original);
  });
});