// Datas no fuso America/Sao_Paulo. Sempre recebe "agora" no momento da chamada.

const TIME_ZONE = "America/Sao_Paulo";
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = (n) => String(n).padStart(2, "0");

// "Hoje" (AAAA-MM-DD) em Brasília.
export function todayInSaoPaulo(nowMs = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(nowMs));
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    // Sem dados de fuso: o Brasil não tem horário de verão desde 2019 (UTC-3).
    const d = new Date(nowMs - 3 * 3600 * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
}

// AAAA-MM-DD existente no calendário (rejeita 2026-02-30, 2026-13-01 etc.).
export function isValidDate(value) {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 2000 || m < 1 || m > 12 || d < 1) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

export function isValidTime(value) {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

// Evento passado = data anterior a hoje em Brasília (mesma regra da criação).
export function isPastDate(eventDate, nowMs = Date.now()) {
  return eventDate < todayInSaoPaulo(nowMs);
}
