const TIME_ZONE = "America/Sao_Paulo";

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function localMidnightAsUtc(year, month, day) {
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(guess));
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    guess += target - represented;
  }
  return new Date(guess);
}

export function weeklyRange(now = new Date()) {
  const current = zonedParts(now);
  const year = Number(current.year);
  const month = Number(current.month);
  const day = Number(current.day);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(Date.UTC(year, month - 1, day - daysSinceMonday));
  const nextMonday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = localMidnightAsUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
  const end = localMidnightAsUtc(nextMonday.getUTCFullYear(), nextMonday.getUTCMonth() + 1, nextMonday.getUTCDate());
  const date = (value) => `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startsOn: date(monday),
    endsOn: date(nextMonday),
  };
}