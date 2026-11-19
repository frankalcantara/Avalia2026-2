export const TYPES = ["perdi", "encontrei"];
export const CATEGORIES = ["eletronicos", "documentos", "garrafas", "vestuario"];

export function validateItem(body) {
  const errors = [];
  const type = String(body.type || "");
  const category = String(body.category || "");
  const title = String(body.title || "").trim();
  const location = String(body.location || "").trim();
  const description = String(body.description || "").trim();
  const event_date = String(body.event_date || "").trim();

  if (!TYPES.includes(type)) errors.push("Tipo inválido.");
  if (!CATEGORIES.includes(category)) errors.push("Categoria inválida.");
  if (title.length < 3 || title.length > 80) errors.push("Título deve ter de 3 a 80 caracteres.");
  if (location.length < 2 || location.length > 120) errors.push("Local deve ter de 2 a 120 caracteres.");
  if (description.length < 10 || description.length > 1000) errors.push("Descrição deve ter de 10 a 1000 caracteres.");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date) || isNaN(Date.parse(event_date))) {
    errors.push("Data inválida (use AAAA-MM-DD).");
  } else if (event_date > new Date().toISOString().slice(0, 10)) {
    errors.push("A data não pode ser futura.");
  }

  return { errors, value: { type, category, title, location, description, event_date } };
}