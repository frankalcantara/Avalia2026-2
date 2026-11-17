// Validação de entrada no servidor (tipo, enum, tamanho, ids, datas).
import { HttpError } from "./http.js";

export const CATEGORIES = ["tecnico", "literario"];
export const MODES = ["emprestimo", "troca", "ambos"];
export const CONDITIONS = ["novo", "bom", "usado", "desgastado"];
export const BOOK_STATUSES = ["Disponível", "Reservado", "Emprestado"];
export const REQUEST_TYPES = ["emprestimo", "troca"];

function bad(code, message) {
  return new HttpError(400, code, message);
}

// Id de rota (/:id): inteiro positivo em texto.
export function parseIdParam(value) {
  const s = String(value ?? "");
  if (!/^[1-9][0-9]{0,15}$/.test(s) || !Number.isSafeInteger(Number(s))) {
    throw new HttpError(404, "not_found", "Recurso não encontrado.");
  }
  return Number(s);
}

// Id vindo do corpo: inteiro positivo (número ou texto só com dígitos).
export function parseIdField(value, field) {
  let n = NaN;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value.trim())) n = Number(value.trim());
  if (!Number.isSafeInteger(n) || n <= 0) throw bad("invalid_" + field, `Campo ${field} deve ser um id inteiro positivo.`);
  return n;
}

// Texto obrigatório com trim e limites de tamanho.
export function requiredString(value, field, min, max) {
  if (typeof value !== "string") throw bad("invalid_" + field, `Campo ${field} é obrigatório e deve ser texto.`);
  const s = value.trim();
  if (s.length < min || s.length > max) {
    throw bad("invalid_" + field, `Campo ${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return s;
}

// Texto opcional: null/undefined/"" → null.
export function optionalString(value, field, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw bad("invalid_" + field, `Campo ${field} deve ser texto.`);
  const s = value.trim();
  if (s === "") return null;
  if (s.length > max) throw bad("invalid_" + field, `Campo ${field} deve ter no máximo ${max} caracteres.`);
  return s;
}

export function enumValue(value, field, allowed) {
  if (typeof value !== "string" || !allowed.includes(value.trim())) {
    throw bad("invalid_" + field, `Campo ${field} deve ser um de: ${allowed.join(", ")}.`);
  }
  return value.trim();
}

export function optionalIsbn(value) {
  const s = optionalString(value, "isbn", 20);
  if (s === null) return null;
  if (!/^[0-9Xx-]+$/.test(s)) throw bad("invalid_isbn", "ISBN deve conter apenas dígitos, X ou hífen.");
  return s.toUpperCase();
}

// Campos descritivos de livro. Com partial=true só valida o que veio.
// status, owner_id, holder_id e outros campos são ignorados silenciosamente.
export function validateBookInput(body, { partial = false } = {}) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;
  if (!partial || has("title")) out.title = requiredString(body.title, "title", 1, 200);
  if (!partial || has("author")) out.author = requiredString(body.author, "author", 1, 150);
  if (!partial || has("category")) out.category = enumValue(body.category, "category", CATEGORIES);
  if (!partial || has("mode")) out.mode = enumValue(body.mode, "mode", MODES);
  if (!partial || has("condition")) out.condition = enumValue(body.condition, "condition", CONDITIONS);
  if (!partial || has("isbn")) out.isbn = optionalIsbn(body.isbn);
  if (!partial || has("description")) out.description = optionalString(body.description, "description", 1000);
  return out;
}

function todayUtc() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// due_date: YYYY-MM-DD real, entre amanhã e hoje+90 dias (UTC), inclusive.
export function validateDueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw bad("invalid_due_date", "due_date é obrigatório no formato YYYY-MM-DD.");
  }
  const s = value.trim();
  const [y, m, d] = s.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw bad("invalid_due_date", "due_date não é uma data válida.");
  }
  const day = 86400000;
  const today = todayUtc();
  if (t < today + day || t > today + 90 * day) {
    throw bad("invalid_due_date", "due_date deve estar entre amanhã e hoje + 90 dias.");
  }
  return s;
}

// Escapa curingas do LIKE (usar com ESCAPE '\').
export function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}
