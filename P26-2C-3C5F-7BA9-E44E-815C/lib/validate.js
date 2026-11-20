export const UNITS = ["g", "kg", "ml", "l", "xícara", "colher de sopa", "colher de chá", "unidade", "pitada"];

const num = (v) => (typeof v === "number" ? v : NaN);
const str = (v) => (typeof v === "string" ? v.trim() : "");

// Valida o corpo de uma receita no servidor. Nunca confia no cliente.
export function validateRecipe(b) {
  const errors = [];
  const title = str(b?.title);
  if (title.length < 3 || title.length > 100) errors.push("O título deve ter de 3 a 100 caracteres.");

  const prep = num(b?.prep_time_min);
  if (!Number.isInteger(prep) || prep < 1 || prep > 1440) errors.push("O tempo de preparo deve ser de 1 a 1440 minutos.");

  const servings = num(b?.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 50) errors.push("O rendimento deve ser de 1 a 50 porções.");

  const rawIngs = Array.isArray(b?.ingredients) ? b.ingredients : [];
  if (rawIngs.length < 1 || rawIngs.length > 50) errors.push("Informe de 1 a 50 ingredientes.");
  const ingredients = rawIngs.slice(0, 50).map((i) => ({ amount: num(i?.amount), unit: i?.unit, name: str(i?.name) }));
  ingredients.forEach((i, n) => {
    if (!(i.amount > 0 && i.amount <= 100000)) errors.push(`Ingrediente ${n + 1}: a quantidade deve ser um número maior que 0.`);
    if (!UNITS.includes(i.unit)) errors.push(`Ingrediente ${n + 1}: unidade inválida.`);
    if (i.name.length < 1 || i.name.length > 80) errors.push(`Ingrediente ${n + 1}: o nome deve ter de 1 a 80 caracteres.`);
  });

  const rawSteps = Array.isArray(b?.steps) ? b.steps : [];
  if (rawSteps.length < 1 || rawSteps.length > 50) errors.push("Informe de 1 a 50 passos de preparo.");
  const steps = rawSteps.slice(0, 50).map(str);
  steps.forEach((s, n) => {
    if (s.length < 1 || s.length > 500) errors.push(`Passo ${n + 1}: o texto deve ter de 1 a 500 caracteres.`);
  });

  return errors.length ? { errors } : { value: { title, prep_time_min: prep, servings, ingredients, steps } };
}
