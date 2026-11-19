import { error, json, withDb } from "../_shared/api.js";
import { sessionUser } from "../_shared/session.js";

const campusDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit" });

function localDay(date) {
  const parts = campusDate.formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDeparture(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:[0-5]\d)$/.test(value)) return null;
  const day = value.slice(0, 10);
  const calendar = new Date(day);
  if (!Number.isFinite(+calendar) || calendar.toISOString().slice(0, 10) !== day) return null;
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString().length === 24 ? date : null;
}

export const onRequestGet = withDb(async ({ request, env }) => {
  const filters = new URL(request.url).searchParams;
  const origin = normalizeText(filters.get("origin"));
  const destination = normalizeText(filters.get("destination"));
  if (origin.length > 120 || destination.length > 120) return error("filtro_invalido", 400);

  const now = new Date();
  const user = await sessionUser(request, env);
  const { results } = await env.DB.prepare(`
    SELECT r.id, r.driver_id, r.origin, r.destination, r.departure_at, r.total_seats,
      r.available_seats, p.passenger_id IS NOT NULL AS reserved
    FROM rides AS r
    LEFT JOIN ride_reservations AS p ON p.ride_id = r.id AND p.passenger_id = ?
    WHERE r.departure_day = ? AND r.departure_at > ?
      AND (r.available_seats > 0 OR p.passenger_id IS NOT NULL)
      AND instr(lower(r.origin), lower(?)) > 0 AND instr(lower(r.destination), lower(?)) > 0
    ORDER BY r.departure_at, r.id
  `).bind(user?.userId ?? null, localDay(now), now.toISOString(), origin, destination).all();
  const rides = [];
  const reservedRides = [];
  for (const { reserved, ...ride } of results) {
    if (ride.available_seats > 0) rides.push(ride);
    if (reserved) reservedRides.push(ride);
  }
  return json({ ok: true, rides, reservedRides });
});

export const onRequestPost = withDb(async ({ request, env }, user) => {
  const body = await request.json().catch(() => null);
  const origin = normalizeText(body?.origin);
  const destination = normalizeText(body?.destination);
  const departure = parseDeparture(body?.departure_at);
  const seats = body?.total_seats;
  if (!origin || origin.length > 120 || !destination || destination.length > 120 ||
      !departure || departure <= new Date() || !Number.isInteger(seats) || seats < 1 || seats > 8) {
    return error("carona_invalida", 400);
  }

  const ride = await env.DB.prepare(`
    INSERT INTO rides (driver_id, origin, destination, departure_at, departure_day,
      total_seats, available_seats)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id, driver_id, origin, destination, departure_at, total_seats, available_seats
  `).bind(user.userId, origin, destination, departure.toISOString(), localDay(departure),
    seats, seats).first();
  return json({ ok: true, ride }, 201);
}, true);
