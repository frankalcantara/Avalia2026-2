// POST /api/requests/:id/return — dono registra a devolução de um empréstimo aprovado.
import { json, route, methodNotAllowed, ensureJsonIfBody } from "../../../../src/http.js";
import { requireUser } from "../../../../src/auth.js";
import { parseIdParam } from "../../../../src/validate.js";
import { returnRequest } from "../../../../src/requests.js";

export const onRequestPost = route(async ({ request, env, params }) => {
  const me = await requireUser(env, request);
  const id = parseIdParam(params.id);
  await ensureJsonIfBody(request);
  return json({ request: await returnRequest(env, id, me) });
});

// Rota só aceita POST: GET responderia com o HTML estático; devolve 405 JSON.
export const onRequestGet = () => methodNotAllowed();
