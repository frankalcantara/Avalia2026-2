import { readSession, json } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  const user = await readSession(request, env);
  if (!user) return json({ ok: false, error: "Não autenticado." }, 401);
  return json({ ok: true, user });
}
