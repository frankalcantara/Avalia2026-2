// Datas de jogo no fuso America/Sao_Paulo (formato YYYY-MM-DD)
import { LAUNCH_DATE, TIMEZONE } from "./config.js";
import { HttpError } from "./http.js";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function today(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function addDays(value, n) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

// Valida a data pedida pelo cliente; vazia = hoje
export function resolveGameDate(input, now = new Date()) {
  const t = today(now);
  if (input === undefined || input === null || input === "") return t;
  if (!isValidDate(input)) throw new HttpError(400, "invalid_date", "Data inválida. Use AAAA-MM-DD.");
  if (input < LAUNCH_DATE) throw new HttpError(400, "before_launch", "Esse cofre é anterior ao lançamento do Cypher.");
  if (input > t) throw new HttpError(403, "future_date", "Esse cofre ainda não pode ser aberto.");
  return input;
}
