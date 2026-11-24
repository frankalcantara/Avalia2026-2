import { requireUser } from "../_lib/auth.js";
import { database, json } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  await requireUser(request, env);
  const { results } = await database(env).prepare(
    "SELECT id, name, category, quantity, minimum_quantity, location FROM items ORDER BY category, name",
  ).all();
  return json({ items: results });
}
