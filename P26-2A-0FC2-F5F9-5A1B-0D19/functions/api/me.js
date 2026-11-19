// GET /api/me: devolve o usuário da sessão ou 401.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { json, methodNotAllowed, safe, unauthorized } from "../_lib/http.js";
import { getSessionUser } from "../_lib/session.js";

export const onRequestGet = safe(async ({ request, env }) => {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  return json({ ok: true, user });
});

export const onRequest = () => methodNotAllowed("GET");
