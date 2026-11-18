/**
 * Validação server-side pura (sem DOM) do payload de receita.
 *
 * Princípios:
 *  * Nunca confiar em campos derivados enviados pelo cliente (`user_id`, `author`, `isOwner`).
 *  * Rejeitar chaves desconhecidas (mass assignment) e tipos errados.
 *  * Normalizar texto (trim + colapso de espaços) e arredondar quantidade a 3 casas.
 *  * Limitar o tamanho total do payload antes de qualquer trabalho pesado.
 *
 * @module functions/api/_lib/validate
 */

/** Limites de negócio (espelhados nos CHECKs da migration). */
export const RECIPE_LIMITS = Object.freeze({
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 600,
  prepMinutesMin: 1,
  prepMinutesMax: 1440,
  baseServingsMin: 1,
  baseServingsMax: 100,
  ingredientsMin: 1,
  ingredientsMax: 40,
  ingredientNameMin: 1,
  ingredientNameMax: 80,
  ingredientUnitMin: 1,
  ingredientUnitMax: 24,
  quantityMin: 0,
  quantityMax: 100000,
  stepsMin: 1,
  stepsMax: 30,
  stepMin: 3,
  stepMax: 500,
  maxPayloadBytes: 32768,
});

/** Chaves aceitas no objeto raiz da receita. */
const RECIPE_KEYS = new Set(["title", "description", "prepMinutes", "baseServings", "ingredients", "steps"]);

/** Chaves aceitas em cada item de ingrediente. */
const INGREDIENT_KEYS = new Set(["name", "quantity", "unit"]);

/**
 * Caracteres de controle proibidos (permite \t, \n e \r, que são colapsados depois).
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Espaços em branco/quebras a colapsar. */
const WHITESPACE_RUN = /\s+/g;

/**
 * Normaliza texto: colapsa espaços (inclusive quebras de linha) e aplica trim.
 *
 * @param {string} value Texto bruto.
 * @returns {string} Texto normalizado.
 */
function normalizeText(value) {
  return value.replace(WHITESPACE_RUN, " ").trim();
}

/**
 * Cria um acumulador de erros de validação.
 *
 * @returns {{ errors: Array<{ field: string, message: string }>, add: (field: string, message: string) => void }}
 */
function createErrorBag() {
  /** @type {Array<{ field: string, message: string }>} */
  const errors = [];
  return {
    errors,
    add(field, message) {
      if (errors.length < 50) errors.push({ field, message });
    },
  };
}

/**
 * Valida uma string de texto livre normalizada.
 *
 * @param {unknown} raw Valor recebido.
 * @param {object} spec Regras (`field`, `min`, `max`).
 * @param {{ add: (field: string, message: string) => void }} bag Acumulador de erros.
 * @returns {string | null} Texto normalizado ou `null` se inválido.
 */
function checkText(raw, spec, bag) {
  if (typeof raw !== "string") {
    bag.add(spec.field, "Deve ser um texto.");
    return null;
  }
  if (FORBIDDEN_CONTROL_CHARS.test(raw)) {
    bag.add(spec.field, "Contém caracteres de controle não permitidos.");
    return null;
  }

  const value = normalizeText(raw);
  if (value.length < spec.min) {
    bag.add(spec.field, `Deve ter no mínimo ${spec.min} caracteres.`);
    return null;
  }
  if (value.length > spec.max) {
    bag.add(spec.field, `Deve ter no máximo ${spec.max} caracteres.`);
    return null;
  }
  return value;
}

/**
 * Valida um inteiro dentro de faixa.
 *
 * @param {unknown} raw Valor recebido.
 * @param {{ field: string, min: number, max: number }} spec Regras.
 * @param {{ add: (field: string, message: string) => void }} bag Acumulador de erros.
 * @returns {number | null} Inteiro válido ou `null`.
 */
function checkInteger(raw, spec, bag) {
  if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) {
    bag.add(spec.field, "Deve ser um número inteiro.");
    return null;
  }
  if (raw < spec.min || raw > spec.max) {
    bag.add(spec.field, `Deve estar entre ${spec.min} e ${spec.max}.`);
    return null;
  }
  return raw;
}

/**
 * Rejeita chaves não previstas no contrato (proteção contra mass assignment).
 *
 * @param {Record<string, unknown>} obj Objeto recebido.
 * @param {Set<string>} allowed Chaves permitidas.
 * @param {string} prefix Prefixo usado no nome do campo do erro.
 * @param {{ add: (field: string, message: string) => void }} bag Acumulador de erros.
 * @returns {boolean} `true` quando não há chaves extras.
 */
function rejectUnknownKeys(obj, allowed, prefix, bag) {
  let ok = true;
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      bag.add(prefix ? `${prefix}.${key}` : key, "Campo não permitido.");
      ok = false;
    }
  }
  return ok;
}

/**
 * Valida e normaliza o payload completo de criação de receita.
 *
 * @param {unknown} input Corpo JSON recebido.
 * @returns {{ value: null | {
 *   title: string,
 *   description: string,
 *   prepMinutes: number,
 *   baseServings: number,
 *   ingredients: Array<{ name: string, quantity: number, unit: string }>,
 *   steps: string[]
 * }, errors: Array<{ field: string, message: string }> }}
 */
export function validateRecipe(input) {
  const bag = createErrorBag();

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { value: null, errors: [{ field: "body", message: "O corpo deve ser um objeto JSON." }] };
  }

  const body = /** @type {Record<string, unknown>} */ (input);

  let serializedLength = 0;
  try {
    serializedLength = JSON.stringify(body).length;
  } catch {
    serializedLength = Number.POSITIVE_INFINITY;
  }
  if (serializedLength > RECIPE_LIMITS.maxPayloadBytes) {
    return { value: null, errors: [{ field: "body", message: "Payload maior que o limite permitido." }] };
  }

  rejectUnknownKeys(body, RECIPE_KEYS, "", bag);

  const title = checkText(
    body.title,
    { field: "title", min: RECIPE_LIMITS.titleMin, max: RECIPE_LIMITS.titleMax },
    bag,
  );
  const description = checkText(
    body.description,
    { field: "description", min: RECIPE_LIMITS.descriptionMin, max: RECIPE_LIMITS.descriptionMax },
    bag,
  );
  const prepMinutes = checkInteger(
    body.prepMinutes,
    { field: "prepMinutes", min: RECIPE_LIMITS.prepMinutesMin, max: RECIPE_LIMITS.prepMinutesMax },
    bag,
  );
  const baseServings = checkInteger(
    body.baseServings,
    { field: "baseServings", min: RECIPE_LIMITS.baseServingsMin, max: RECIPE_LIMITS.baseServingsMax },
    bag,
  );

  /* ----------------------------- Ingredientes ----------------------------- */
  /** @type {Array<{ name: string, quantity: number, unit: string }>} */
  const ingredients = [];
  const rawIngredients = body.ingredients;

  if (!Array.isArray(rawIngredients)) {
    bag.add("ingredients", "Deve ser uma lista de ingredientes.");
  } else if (
    rawIngredients.length < RECIPE_LIMITS.ingredientsMin ||
    rawIngredients.length > RECIPE_LIMITS.ingredientsMax
  ) {
    bag.add(
      "ingredients",
      `Deve conter entre ${RECIPE_LIMITS.ingredientsMin} e ${RECIPE_LIMITS.ingredientsMax} ingredientes.`,
    );
  } else {
    rawIngredients.forEach((item, index) => {
      const field = `ingredients[${index}]`;
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        bag.add(field, "Cada ingrediente deve ser um objeto.");
        return;
      }

      const ingredient = /** @type {Record<string, unknown>} */ (item);
      rejectUnknownKeys(ingredient, INGREDIENT_KEYS, field, bag);

      const name = checkText(
        ingredient.name,
        { field: `${field}.name`, min: RECIPE_LIMITS.ingredientNameMin, max: RECIPE_LIMITS.ingredientNameMax },
        bag,
      );
      const unit = checkText(
        ingredient.unit,
        { field: `${field}.unit`, min: RECIPE_LIMITS.ingredientUnitMin, max: RECIPE_LIMITS.ingredientUnitMax },
        bag,
      );

      let quantity = null;
      if (typeof ingredient.quantity !== "number" || !Number.isFinite(ingredient.quantity)) {
        bag.add(`${field}.quantity`, "Deve ser um número finito.");
      } else if (
        ingredient.quantity < RECIPE_LIMITS.quantityMin ||
        ingredient.quantity > RECIPE_LIMITS.quantityMax
      ) {
        bag.add(
          `${field}.quantity`,
          `Deve estar entre ${RECIPE_LIMITS.quantityMin} e ${RECIPE_LIMITS.quantityMax}.`,
        );
      } else {
        quantity = Math.round(ingredient.quantity * 1000) / 1000;
      }

      if (name !== null && unit !== null && quantity !== null) {
        ingredients.push({ name, quantity, unit });
      }
    });
  }

  /* --------------------------------- Passos -------------------------------- */
  /** @type {string[]} */
  const steps = [];
  const rawSteps = body.steps;

  if (!Array.isArray(rawSteps)) {
    bag.add("steps", "Deve ser uma lista de passos.");
  } else if (rawSteps.length < RECIPE_LIMITS.stepsMin || rawSteps.length > RECIPE_LIMITS.stepsMax) {
    bag.add("steps", `Deve conter entre ${RECIPE_LIMITS.stepsMin} e ${RECIPE_LIMITS.stepsMax} passos.`);
  } else {
    rawSteps.forEach((step, index) => {
      const value = checkText(
        step,
        { field: `steps[${index}]`, min: RECIPE_LIMITS.stepMin, max: RECIPE_LIMITS.stepMax },
        bag,
      );
      if (value !== null) steps.push(value);
    });
  }

  if (bag.errors.length > 0) {
    return { value: null, errors: bag.errors };
  }

  return {
    value: {
      title: /** @type {string} */ (title),
      description: /** @type {string} */ (description),
      prepMinutes: /** @type {number} */ (prepMinutes),
      baseServings: /** @type {number} */ (baseServings),
      ingredients,
      steps,
    },
    errors: [],
  };
}

/**
 * Interpreta um parâmetro de rota inteiro positivo (ex.: `/api/recipes/12`).
 *
 * @param {unknown} raw Valor bruto de `params.id`.
 * @returns {number | null} Inteiro positivo ou `null` quando inválido.
 */
export function parsePositiveId(raw) {
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}
