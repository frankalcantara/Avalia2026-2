// Datas de devolução são dias de calendário da universidade, em São Paulo.
export function calendarDay(offset = 0, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = new Date(`${date.year}-${date.month}-${date.day}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
