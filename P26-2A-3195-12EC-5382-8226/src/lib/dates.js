/**
 * Utilitários de data puros (sem dependências), sempre em UTC para evitar
 * deslocamentos de fuso. Datas trafegam como strings ISO "YYYY-MM-DD".
 */

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Converte "YYYY-MM-DD" em número de dias desde a época (inteiro), ou null se inválida. */
export function toDayNumber(iso) {
  if (typeof iso !== "string") return null;
  const m = DATE_RE.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // rejeita datas como 2026-02-30 (que o Date "corrigiria" para março)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(ms / DAY_MS);
}

/** Converte número de dias desde a época em "YYYY-MM-DD". */
export function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function isValidDate(iso) {
  return toDayNumber(iso) !== null;
}

export function isValidMonth(month) {
  if (typeof month !== "string") return false;
  const m = MONTH_RE.exec(month);
  if (!m) return false;
  const mo = Number(m[2]);
  return Number(m[1]) >= 2000 && mo >= 1 && mo <= 12;
}

export function addDays(iso, delta) {
  return fromDayNumber(toDayNumber(iso) + delta);
}

/** Data de hoje em UTC no servidor. */
export function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * O "hoje" do usuário depende do fuso dele. O cliente informa a própria data,
 * mas o servidor NÃO confia cegamente: só aceita valores a no máximo 1 dia de
 * distância do UTC (fusos vão de UTC-12 a UTC+14). Fora disso, usa o UTC.
 */
export function resolveToday(clientToday, now = new Date()) {
  const server = utcToday(now);
  if (!isValidDate(clientToday)) return server;
  const diff = toDayNumber(clientToday) - toDayNumber(server);
  return Math.abs(diff) <= 1 ? clientToday : server;
}

export function monthOf(iso) {
  return iso.slice(0, 7);
}

export function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Primeiro e último dia ("YYYY-MM-DD") de um mês "YYYY-MM". */
export function monthBounds(month) {
  const last = daysInMonth(month);
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, "0")}` };
}

/**
 * Dias "elegíveis" do mês até hoje (inclusive): base de cálculo da taxa mensal.
 * - mês passado: todos os dias do mês
 * - mês corrente: do dia 1 até hoje
 * - mês futuro: 0
 */
export function elapsedDaysInMonth(month, today) {
  const current = monthOf(today);
  if (month < current) return daysInMonth(month);
  if (month > current) return 0;
  return Number(today.slice(8, 10));
}
