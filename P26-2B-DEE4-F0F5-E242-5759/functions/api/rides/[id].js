import { error, json, withDb } from "../../_shared/api.js";

function rideId(value) {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const onRequestGet = withDb(async ({ env, params }, user) => {
  const id = rideId(params.id);
  if (!id) return error("id_invalido", 400);
  const ride = await env.DB.prepare("SELECT id FROM rides WHERE id = ? AND driver_id = ?")
    .bind(id, user.userId).first();
  if (!ride) return error("carona_nao_encontrada", 404);

  const { results } = await env.DB.prepare(`
    SELECT u.user_id, u.username, u.avatar, r.created_at
    FROM ride_reservations AS r JOIN discord_users AS u ON u.user_id = r.passenger_id
    WHERE r.ride_id = ? ORDER BY r.created_at, u.user_id
  `).bind(id).all();
  return json({ ok: true, passengers: results });
}, true);

export const onRequestPost = withDb(async ({ env, params }, user) => {
  const id = rideId(params.id);
  if (!id) return error("id_invalido", 400);

  // A inserção e o decremento pelo gatilho são parte do mesmo comando SQL.
  const reservation = await env.DB.prepare(`
    INSERT INTO ride_reservations (ride_id, passenger_id)
    SELECT id, ? FROM rides
    WHERE id = ? AND driver_id <> ? AND available_seats > 0
      AND departure_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ON CONFLICT (ride_id, passenger_id) DO NOTHING
    RETURNING ride_id, passenger_id, created_at
  `).bind(user.userId, id, user.userId).first();
  if (reservation) return json({ ok: true, reservation }, 201);

  const ride = await env.DB.prepare("SELECT driver_id FROM rides WHERE id = ?").bind(id).first();
  if (!ride) return error("carona_nao_encontrada", 404);
  if (ride.driver_id === user.userId) return error("reserva_do_motorista", 403);
  const existing = await env.DB.prepare(`
    SELECT ride_id, passenger_id, created_at FROM ride_reservations
    WHERE ride_id = ? AND passenger_id = ?
  `).bind(id, user.userId).first();
  if (existing) return json({ ok: true, reservation: existing });
  return error("carona_indisponivel", 409);
}, true);
