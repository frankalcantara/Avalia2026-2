import { json, withDb } from "../../_shared/api.js";

export const onRequestGet = withDb(async ({ env }, user) => {
  const { results } = await env.DB.prepare(`
    SELECT id, driver_id, origin, destination, departure_at, total_seats, available_seats
    FROM rides WHERE driver_id = ? ORDER BY departure_at DESC, id DESC
  `).bind(user.userId).all();
  return json({ ok: true, rides: results });
}, true);
