import { database, json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  await database(env).prepare("SELECT id FROM items LIMIT 1").first();
  return json({ ok: true, d1Connected: true });
}
