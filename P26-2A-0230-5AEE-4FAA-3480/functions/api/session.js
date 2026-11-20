import { readSession } from "../_lib/auth.js";
import { json } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  return json({ user: session?.user ?? null });
}
