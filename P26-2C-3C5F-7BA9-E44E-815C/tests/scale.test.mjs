import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleAmount, formatAmount } from "../public/scale.js";

test("2 para 5 porções: 200 g viram 500 g", () => assert.equal(scaleAmount(200, 2, 5), 500));
test("reduzir: 3 unidades de 6 para 2 porções viram 1", () => assert.equal(scaleAmount(3, 6, 2), 1));
test("mesmo rendimento não altera a quantidade", () => assert.equal(scaleAmount(1.5, 4, 4), 1.5));
test("formata com vírgula e no máximo 2 casas", () => {
  assert.equal(formatAmount(1.5), "1,5");
  assert.equal(formatAmount(0.3333333), "0,33");
  assert.equal(formatAmount(500), "500");
});
