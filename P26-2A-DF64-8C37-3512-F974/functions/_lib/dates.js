// Datas de calendário (YYYY-MM-DD) no fuso horário do estudante.
// A "fila diária" depende do dia local, não do dia UTC do servidor.

export const DEFAULT_TZ = 'America/Sao_Paulo';

export function resolveTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

export function todayIn(tz, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(isoDate, days) {
  if (!isIsoDate(isoDate)) throw new RangeError(`Data inválida: ${isoDate}`);
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas YYYY-MM-DD (b - a). */
export function diffDays(a, b) {
  const toUtc = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** "Hoje" do estudante logado, pelo fuso gravado no servidor (definido no middleware). */
export function todayFor(data) {
  return todayIn(resolveTimeZone(data?.tz));
}
