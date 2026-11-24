import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRecipe } from "../lib/validate.js";

const ok = () => ({
  title: "Bolo de cenoura", prep_time_min: 60, servings: 8,
  ingredients: [{ amount: 3, unit: "unidade", name: "cenoura" }, { amount: 200, unit: "g", name: "açúcar" }],
  steps: ["Bata tudo no liquidificador.", "Asse por 40 minutos."],
});

test("receita válida passa", () => assert.ok(validateRecipe(ok()).value));
test("quantidade como texto é rejeitada", () => {
  const b = ok(); b.ingredients[0].amount = "3";
  assert.ok(validateRecipe(b).errors);
});
test("quantidade zero ou negativa é rejeitada", () => {
  for (const a of [0, -1]) { const b = ok(); b.ingredients[0].amount = a; assert.ok(validateRecipe(b).errors); }
});
test("unidade fora da lista é rejeitada", () => {
  const b = ok(); b.ingredients[0].unit = "balde";
  assert.ok(validateRecipe(b).errors);
});
test("sem ingredientes, sem passos ou título curto são rejeitados", () => {
  for (const patch of [{ ingredients: [] }, { steps: [] }, { title: "ab" }, { servings: 0 }, { prep_time_min: 2000 }]) {
    assert.ok(validateRecipe({ ...ok(), ...patch }).errors, JSON.stringify(patch));
  }
});
test("corpo vazio não quebra", () => assert.ok(validateRecipe(undefined).errors));
