import { json, requireDatabase } from "../_lib/http.js";
import { listTags } from "../_lib/tags.js";

export async function onRequestGet({ env }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  return json({ tags: await listTags(env.DB) });
}
