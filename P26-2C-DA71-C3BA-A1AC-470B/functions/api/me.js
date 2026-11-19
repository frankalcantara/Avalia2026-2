// GET /api/me — dados do usuário logado.
import { json } from "../_lib/http.js";
import { requireUser } from "../_lib/session.js";

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  return json({ ok: true, user });
}
