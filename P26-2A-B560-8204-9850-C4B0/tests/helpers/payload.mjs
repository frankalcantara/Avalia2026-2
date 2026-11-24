/**
 * Construtores de payloads válidos e inválidos para as rotas de receita.
 *
 * @module tests/helpers/payload
 */

/**
 * Payload minimamente válido de receita (passa em `validateRecipe`).
 *
 * @param {Record<string, unknown>} [overrides] Campos sobrescritos.
 * @returns {Record<string, unknown>} Corpo pronto para `POST /api/recipes`.
 */
export function validRecipePayload(overrides = {}) {
  return {
    title: "Torta de Limão",
    description: "Torta gelada de limão com massa de biscoito e merengue.",
    prepMinutes: 40,
    baseServings: 6,
    ingredients: [
      { name: "Limão", quantity: 4, unit: "unidade" },
      { name: "Leite condensado", quantity: 1, unit: "lata" },
      { name: "Creme de leite", quantity: 200, unit: "grama" },
    ],
    steps: [
      "Bata o leite condensado com o suco de limão.",
      "Monte a torta e leve à geladeira por três horas.",
    ],
    ...overrides,
  };
}

/**
 * Ingrediente válido, permitindo variar um único campo.
 *
 * @param {Record<string, unknown>} [overrides] Campos sobrescritos.
 * @returns {{ name: string, quantity: number, unit: string }} Ingrediente.
 */
export function validIngredient(overrides = {}) {
  return { name: "Farinha", quantity: 200, unit: "grama", ...overrides };
}
