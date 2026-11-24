// Regras de negócio puras (sem I/O): datas, streaks e taxa de cumprimento.
// Todas as datas são strings ISO "YYYY-MM-DD"; meses são "YYYY-MM".

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export function isValidISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidMonth(value) {
  if (typeof value !== 'string' || !ISO_MONTH.test(value)) return false;
  const [y, m] = value.split('-').map(Number);
  return y >= MIN_YEAR && y <= MAX_YEAR && m >= 1 && m <= 12;
}

/** Número inteiro de dias desde a época (UTC) — evita qualquer problema de fuso/DST. */
export function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "Hoje" (YYYY-MM-DD) no fuso informado. Monta a string a partir das partes, sem depender do formato do locale. */
export function todayInTimeZone(timeZone = 'America/Sao_Paulo', now = new Date()) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)) {
    parts[p.type] = p.value;
  }
  return `${parts.year.padStart(4, '0')}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
}

/**
 * Streak máximo (maior sequência de dias consecutivos) e streak atual.
 * - Datas futuras (> today) e inválidas são ignoradas; duplicatas contam uma vez.
 * - Streak atual: sequência que termina hoje; se hoje ainda não foi marcado,
 *   a sequência que termina ontem continua valendo (o dia ainda não acabou).
 */
export function computeStreaks(dates, today) {
  const t = dayNumber(today);
  const days = [...new Set((dates ?? []).filter(isValidISODate).map(dayNumber))]
    .filter((n) => n <= t)
    .sort((a, b) => a - b);

  let maxStreak = 0;
  let run = 0;
  let prev = null;
  for (const n of days) {
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    if (run > maxStreak) maxStreak = run;
    prev = n;
  }

  const set = new Set(days);
  let cursor = set.has(t) ? t : t - 1;
  let currentStreak = 0;
  while (set.has(cursor)) {
    currentStreak += 1;
    cursor -= 1;
  }
  return { maxStreak, currentStreak };
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Cumprimento mensal: dias concluídos / dias elegíveis do mês.
 * Dias elegíveis = dias do mês já iniciados (até hoje); mês passado = mês inteiro;
 * mês futuro = 0.
 */
export function computeMonthStats(dates, month, today) {
  const total = daysInMonth(month);
  const elapsed = dayNumber(today) - dayNumber(`${month}-01`) + 1;
  const monthEligible = Math.max(0, Math.min(total, elapsed));
  const inMonth = new Set(
    (dates ?? []).filter(
      (d) => isValidISODate(d) && d.startsWith(`${month}-`) && Number(d.slice(8)) <= monthEligible,
    ),
  );
  const monthCompleted = inMonth.size;
  const monthRate = monthEligible === 0 ? 0 : round1((monthCompleted / monthEligible) * 100);
  return { monthCompleted, monthEligible, monthRate };
}

export function computeHabitStats(dates, month, today) {
  return { ...computeStreaks(dates, today), ...computeMonthStats(dates, month, today) };
}

/**
 * Indicadores consolidados de todos os hábitos:
 * - streaks: o melhor entre os hábitos;
 * - taxa: soma dos dias concluídos / soma dos dias elegíveis.
 */
export function computeOverall(habitStats) {
  if (!habitStats.length) {
    return { currentStreak: 0, maxStreak: 0, monthCompleted: 0, monthEligible: 0, monthRate: 0 };
  }
  const monthCompleted = habitStats.reduce((s, h) => s + h.monthCompleted, 0);
  const monthEligible = habitStats.reduce((s, h) => s + h.monthEligible, 0);
  return {
    currentStreak: Math.max(...habitStats.map((h) => h.currentStreak)),
    maxStreak: Math.max(...habitStats.map((h) => h.maxStreak)),
    monthCompleted,
    monthEligible,
    monthRate: monthEligible === 0 ? 0 : round1((monthCompleted / monthEligible) * 100),
  };
}
