/**
 * Regras de negócio validadas no servidor. Cada função devolve
 * { ok: true, value } ou { ok: false, error } para o handler responder 400/409/422.
 */
import { isValidDate, toDayNumber, isValidMonth, monthOf } from "./dates.js";

export const HABIT_NAME_MAX = 60;
export const MAX_HABITS_PER_USER = 30;
export const BACKFILL_LIMIT_DAYS = 366;
export const HABIT_COLORS = ["azul", "verde", "roxo", "laranja", "rosa", "ciano"];

export function validateHabitName(raw) {
  if (typeof raw !== "string") return { ok: false, error: "O nome do hábito é obrigatório." };
  // normaliza acentos (NFC), remove caracteres de controle e invisíveis
  // (largura zero, marcas de direção, BOM) e colapsa espaços repetidos
  const value = raw
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁯﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return { ok: false, error: "O nome do hábito é obrigatório." };
  if (value.length > HABIT_NAME_MAX) {
    return { ok: false, error: `O nome deve ter no máximo ${HABIT_NAME_MAX} caracteres.` };
  }
  return { ok: true, value };
}

export function validateColor(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "azul" };
  if (typeof raw !== "string" || !HABIT_COLORS.includes(raw)) {
    return { ok: false, error: `Cor inválida. Use uma de: ${HABIT_COLORS.join(", ")}.` };
  }
  return { ok: true, value: raw };
}

export function validateHabitId(raw) {
  const s = String(raw ?? "");
  if (!/^[1-9]\d{0,15}$/.test(s)) return { ok: false, error: "ID de hábito inválido." };
  return { ok: true, value: Number(s) };
}

/**
 * Data de conclusão: formato válido, não pode estar no futuro e não pode ser
 * anterior a BACKFILL_LIMIT_DAYS dias (evita lixo histórico).
 */
export function validateCompletionDate(raw, today) {
  if (!isValidDate(raw)) return { ok: false, error: "Data inválida. Use o formato AAAA-MM-DD." };
  const diff = toDayNumber(today) - toDayNumber(raw);
  if (diff < 0) return { ok: false, error: "Não é possível marcar um dia que ainda não chegou." };
  if (diff > BACKFILL_LIMIT_DAYS) return { ok: false, error: "Data muito antiga para registro." };
  return { ok: true, value: raw };
}

/** Mês consultado: padrão = mês de hoje; não pode ser futuro. */
export function validateMonth(raw, today) {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: monthOf(today) };
  if (!isValidMonth(raw)) return { ok: false, error: "Mês inválido. Use o formato AAAA-MM." };
  if (raw > monthOf(today)) return { ok: false, error: "Não é possível consultar meses futuros." };
  return { ok: true, value: raw };
}
