/**
 * Métricas consolidadas calculadas NO SERVIDOR (o cliente só exibe).
 * Funções puras: recebem listas de datas "YYYY-MM-DD" e devolvem números.
 */
import { toDayNumber, monthBounds, elapsedDaysInMonth } from "./dates.js";

/** Normaliza: remove inválidas, datas futuras e duplicadas; devolve números de dia ordenados. */
function normalize(dates, today) {
  const limit = toDayNumber(today);
  const set = new Set();
  for (const d of dates) {
    const n = toDayNumber(d);
    if (n !== null && n <= limit) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** Maior sequência de dias consecutivos cumpridos (streak máximo) em todo o histórico. */
export function maxStreak(dates, today) {
  const days = normalize(dates, today);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Sequência atual: dias consecutivos terminando hoje.
 * Se hoje ainda não foi marcado, a sequência continua "viva" contando até ontem
 * (o dia ainda não acabou); se ontem também não foi, a sequência é 0.
 */
export function currentStreak(dates, today) {
  const days = normalize(dates, today);
  const set = new Set(days);
  const t = toDayNumber(today);
  let cursor = set.has(t) ? t : t - 1;
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor--;
  }
  return count;
}

/** Arredonda percentuais para 1 casa decimal. */
function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Taxa de cumprimento mensal = dias cumpridos no mês / dias elegíveis do mês.
 * Dias elegíveis vão do início da contagem até hoje (mês corrente) ou até o fim do mês (meses passados).
 * O início da contagem é o dia 1, ou o dia em que o hábito foi criado se ele nasceu no meio do mês
 * (um hábito novo não começa "devendo" os dias anteriores). Se o usuário marcou dias anteriores
 * à criação, a contagem recua até a primeira marcação, então a taxa nunca passa de 100%.
 */
export function monthlyStats(dates, month, today, createdAt = null) {
  const { first, last } = monthBounds(month);
  const days = normalize(dates, today);
  const lo = toDayNumber(first);
  const hi = toDayNumber(last);
  const inMonth = days.filter((n) => n >= lo && n <= hi);
  const completedDays = inMonth.length;

  const elapsed = elapsedDaysInMonth(month, today);
  if (elapsed === 0) return { completedDays: 0, eligibleDays: 0, rate: 0 };
  const end = lo + elapsed - 1; // último dia contado

  let start = lo;
  const created = createdAt ? toDayNumber(String(createdAt).slice(0, 10)) : null;
  if (created !== null && created > start) start = created;
  if (inMonth.length && inMonth[0] < start) start = inMonth[0];
  if (start > end) return { completedDays, eligibleDays: 0, rate: 0 }; // hábito criado depois deste mês

  const eligibleDays = end - start + 1;
  return { completedDays, eligibleDays, rate: pct(completedDays, eligibleDays) };
}

/** Métricas completas de um hábito. */
export function habitMetrics(dates, month, today, createdAt = null) {
  const m = monthlyStats(dates, month, today, createdAt);
  return {
    completedDays: m.completedDays,
    eligibleDays: m.eligibleDays,
    monthlyRate: m.rate,
    currentStreak: currentStreak(dates, today),
    maxStreak: maxStreak(dates, today),
    doneToday: dates.includes(today),
  };
}

/** Resumo do painel a partir das métricas de cada hábito. */
export function summarize(perHabit) {
  const habits = perHabit.length;
  let completed = 0;
  let eligible = 0;
  let bestCurrent = 0;
  let bestMax = 0;
  let doneToday = 0;
  for (const h of perHabit) {
    completed += h.completedDays;
    eligible += h.eligibleDays;
    bestCurrent = Math.max(bestCurrent, h.currentStreak);
    bestMax = Math.max(bestMax, h.maxStreak);
    if (h.doneToday) doneToday++;
  }
  return {
    habits,
    completedDays: completed,
    eligibleDays: eligible,
    monthlyRate: pct(completed, eligible),
    bestCurrentStreak: bestCurrent,
    bestMaxStreak: bestMax,
    doneToday,
  };
}
