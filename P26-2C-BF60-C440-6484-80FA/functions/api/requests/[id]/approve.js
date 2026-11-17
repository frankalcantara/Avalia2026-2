// POST /api/requests/:id/approve — dono aprova (empréstimo exige due_date; troca transfere os livros).
import { json, route, methodNotAllowed, readJson } from "../../../../src/http.js";
import { requireUser } from "../../../../src/auth.js";
import { parseIdParam } from "../../../../src/validate.js";
import { approveRequest } from "../../../../src/requests.js";

export const onRequestPost = route(async ({ request, env, params }) => {
  const me = await requireUser(env, request);
  const id = parseIdParam(params.id);
  const body = await readJson(request, { optional: true });
  return json({ request: await approveRequest(env, id, me, body) });
});

// Rota só aceita POST: GET responderia com o HTML estático; devolve 405 JSON.
export const onRequestGet = () => methodNotAllowed();
