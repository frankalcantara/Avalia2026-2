/**
 * Validação server-side — `functions/api/_lib/validate.js`.
 *
 * Cobre: normalização, limites de negócio, tipos, mass assignment, caracteres
 * de controle e o parser de id de rota.
 *
 * @module tests/validate.test
 */

import test from "node:test";
import assert from "node:assert/strict";

import { RECIPE_LIMITS, parsePositiveId, validateRecipe } from "../functions/api/_lib/validate.js";
import { validIngredient, validRecipePayload } from "./helpers/payload.mjs";

/**
 * Indica se o erro do campo foi reportado.
 *
 * @param {Array<{ field: string, message: string }>} errors Erros devolvidos.
 * @param {string} field Nome do campo.
 * @returns {boolean} `true` quando o campo tem erro.
 */
function hasError(errors, field) {
  return errors.some((error) => error.field === field);
}

/**
 * Roda a validação esperando falha e devolve os erros.
 *
 * @param {unknown} payload Corpo a validar.
 * @returns {Array<{ field: string, message: string }>} Erros.
 */
function expectInvalid(payload) {
  const result = validateRecipe(payload);
  assert.equal(result.value, null, "payload inválido não pode produzir valor");
  assert.ok(result.errors.length > 0, "payload inválido precisa reportar ao menos um erro");
  return result.errors;
}

test("validateRecipe normaliza texto e arredonda quantidade a 3 casas", () => {
  const { value, errors } = validateRecipe({
    title: "  Torta   de\tLimão  ",
    description: "  Massa de biscoito\ncom limão e merengue.  ",
    prepMinutes: 40,
    baseServings: 6,
    ingredients: [
      { name: "  Limão   siciliano ", quantity: 1.23456, unit: " unidade " },
      { name: "Açúcar", quantity: 2.0004, unit: "xícara" },
    ],
    steps: ["  Bata tudo   no liquidificador.  "],
  });

  assert.deepEqual(errors, []);
  assert.ok(value);
  assert.equal(value.title, "Torta de Limão");
  assert.equal(value.description, "Massa de biscoito com limão e merengue.");
  assert.equal(value.steps[0], "Bata tudo no liquidificador.");
  assert.equal(value.ingredients[0].name, "Limão siciliano");
  assert.equal(value.ingredients[0].unit, "unidade");
  assert.equal(value.ingredients[0].quantity, 1.235, "1.23456 deve virar 1.235");
  assert.equal(value.ingredients[1].quantity, 2, "2.0004 deve virar 2");
});

test("validateRecipe aceita os limites exatos da receita", () => {
  const payload = validRecipePayload({
    title: "a".repeat(RECIPE_LIMITS.titleMax),
    description: "d".repeat(RECIPE_LIMITS.descriptionMax),
    prepMinutes: RECIPE_LIMITS.prepMinutesMax,
    baseServings: RECIPE_LIMITS.baseServingsMax,
    ingredients: Array.from({ length: RECIPE_LIMITS.ingredientsMax }, (_, index) =>
      validIngredient({ name: `Ingrediente ${index + 1}` }),
    ),
    steps: Array.from({ length: RECIPE_LIMITS.stepsMax }, (_, index) => `Passo número ${index + 1}`),
  });

  const { value, errors } = validateRecipe(payload);
  assert.deepEqual(errors, []);
  assert.ok(value);
  assert.equal(value.ingredients.length, RECIPE_LIMITS.ingredientsMax);
  assert.equal(value.steps.length, RECIPE_LIMITS.stepsMax);
});

test("validateRecipe rejeita título fora do intervalo 3..120", () => {
  assert.ok(hasError(expectInvalid(validRecipePayload({ title: "ab" })), "title"), "título curto");
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ title: "a".repeat(RECIPE_LIMITS.titleMax + 1) })), "title"),
    "título longo",
  );
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ title: "   a   " })), "title"),
    "título que só fica curto após o trim",
  );
  assert.ok(hasError(expectInvalid(validRecipePayload({ title: 42 })), "title"), "título não textual");
});

test("validateRecipe rejeita descrição com menos de 10 caracteres", () => {
  assert.ok(hasError(expectInvalid(validRecipePayload({ description: "curta" })), "description"));
  assert.ok(hasError(expectInvalid(validRecipePayload({ description: 10 })), "description"));
});

test("validateRecipe rejeita prepMinutes inválido (0, negativo, fracionário e string)", () => {
  for (const prepMinutes of [0, -1, 1.5, "10", Number.NaN, Number.POSITIVE_INFINITY, null]) {
    const errors = expectInvalid(validRecipePayload({ prepMinutes }));
    assert.ok(hasError(errors, "prepMinutes"), `prepMinutes=${String(prepMinutes)} deve falhar`);
  }
});

test("validateRecipe rejeita baseServings acima do máximo", () => {
  assert.ok(hasError(expectInvalid(validRecipePayload({ baseServings: 101 })), "baseServings"));
  assert.ok(hasError(expectInvalid(validRecipePayload({ baseServings: 0 })), "baseServings"));
});

test("validateRecipe rejeita lista de ingredientes vazia ou acima de 40", () => {
  assert.ok(hasError(expectInvalid(validRecipePayload({ ingredients: [] })), "ingredients"), "lista vazia");

  const quarentaEUm = Array.from({ length: 41 }, (_, index) =>
    validIngredient({ name: `Ingrediente ${index + 1}` }),
  );
  assert.ok(hasError(expectInvalid(validRecipePayload({ ingredients: quarentaEUm })), "ingredients"), "41 itens");

  assert.ok(
    hasError(expectInvalid(validRecipePayload({ ingredients: "farinha" })), "ingredients"),
    "não é array",
  );
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ ingredients: ["farinha"] })), "ingredients[0]"),
    "item não é objeto",
  );
});

test("validateRecipe rejeita quantidade não numérica, infinita, negativa ou fora do teto", () => {
  for (const quantity of ["abc", Number.NaN, Number.POSITIVE_INFINITY, -1, -0.001, RECIPE_LIMITS.quantityMax + 1]) {
    const errors = expectInvalid(validRecipePayload({ ingredients: [validIngredient({ quantity })] }));
    assert.ok(
      hasError(errors, "ingredients[0].quantity"),
      `quantity=${String(quantity)} deve falhar em ingredients[0].quantity`,
    );
  }
});

test("validateRecipe aceita quantidade zero e rejeita unidade vazia", () => {
  const zero = validateRecipe(validRecipePayload({ ingredients: [validIngredient({ quantity: 0 })] }));
  assert.deepEqual(zero.errors, []);
  assert.equal(zero.value?.ingredients[0].quantity, 0);

  for (const unit of ["", "   "]) {
    assert.ok(hasError(expectInvalid(validRecipePayload({ ingredients: [validIngredient({ unit })] })), "ingredients[0].unit"));
  }
  assert.ok(
    hasError(
      expectInvalid(validRecipePayload({ ingredients: [validIngredient({ name: "" })] })),
      "ingredients[0].name",
    ),
  );
});

test("validateRecipe rejeita passos vazios, curtos ou não textuais", () => {
  assert.ok(hasError(expectInvalid(validRecipePayload({ steps: [] })), "steps"), "lista vazia");
  assert.ok(hasError(expectInvalid(validRecipePayload({ steps: "misture" })), "steps"), "não é array");
  assert.ok(hasError(expectInvalid(validRecipePayload({ steps: ["oi"] })), "steps[0]"), "passo curto");
  assert.ok(hasError(expectInvalid(validRecipePayload({ steps: [42] })), "steps[0]"), "passo não textual");
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ steps: ["a".repeat(RECIPE_LIMITS.stepMax + 1)] })), "steps[0]"),
    "passo longo",
  );
});

test("validateRecipe rejeita campos extras no corpo e no ingrediente (mass assignment)", () => {
  const corpo = expectInvalid(validRecipePayload({ user_id: "200000000000000002" }));
  assert.ok(hasError(corpo, "user_id"));
  assert.ok(corpo.some((error) => error.message === "Campo não permitido."));

  const autor = expectInvalid(validRecipePayload({ author: { userId: "x" } }));
  assert.ok(hasError(autor, "author"));

  const ingrediente = expectInvalid(
    validRecipePayload({ ingredients: [validIngredient({ recipe_id: 99 })] }),
  );
  assert.ok(hasError(ingrediente, "ingredients[0].recipe_id"));
});

test("validateRecipe rejeita caracteres de controle em texto livre", () => {
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ title: "Bolo\u0000de cenoura" })), "title"),
    "NUL no título",
  );
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ description: "Descrição com \u001F controle." })), "description"),
    "control char na descrição",
  );
  assert.ok(
    hasError(expectInvalid(validRecipePayload({ steps: ["Passo com \u0007 bell"] })), "steps[0]"),
    "control char no passo",
  );
});

test("validateRecipe rejeita corpos que não são objetos JSON", () => {
  for (const payload of [null, [], "texto", 42, true]) {
    const errors = expectInvalid(payload);
    assert.ok(hasError(errors, "body"));
  }
});

test("validateRecipe rejeita payload acima do limite de bytes", () => {
  const errors = expectInvalid(
    validRecipePayload({ description: "d".repeat(RECIPE_LIMITS.maxPayloadBytes), steps: ["passo válido"] }),
  );
  assert.ok(hasError(errors, "body"));
  assert.match(errors[0].message, /limite/);
});

test("parsePositiveId aceita apenas inteiros positivos decimais", () => {
  assert.equal(parsePositiveId("1"), 1);
  assert.equal(parsePositiveId("0007"), 7);
  assert.equal(parsePositiveId("9999999999"), 9999999999);

  for (const invalid of ["abc", "-1", "1.5", "0", "", " 1", "1 ", "1e3", "+1", "99999999999"]) {
    assert.equal(parsePositiveId(invalid), null, `"${invalid}" deve ser rejeitado`);
  }
  assert.equal(parsePositiveId(1), null);
  assert.equal(parsePositiveId(undefined), null);
});
