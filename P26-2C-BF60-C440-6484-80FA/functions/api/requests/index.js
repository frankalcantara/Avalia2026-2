// POST /api/requests (novo pedido) e GET /api/requests?box=incoming|outgoing
import { json, route, readJson, HttpError } from "../../../src/http.js";
import { requireUser } from "../../../src/auth.js";
import { createRequest } from "../../../src/requests.js";
import { REQUEST_SELECT, toRequest } from "../../../src/serialize.js";

export const onRequestPost = route(async ({ request, env }) => {
  const me = await requireUser(env, request);
  const body = await readJson(request);
  return json({ request: await createRequest(env, me, body) }, 201);
});

export const onRequestGet = route(async ({ request, env }) => {
  const me = await requireUser(env, request);
  const box = new URL(request.url).searchParams.get("box");
  // incoming usa requests.owner_id (dono no momento do pedido), não o dono atual do livro.
  const col = box === "incoming" ? "r.owner_id" : box === "outgoing" ? "r.requester_id" : null;
  if (!col) throw new HttpError(400, "invalid_box", "Parâmetro box deve ser incoming ou outgoing.");
  const { results } = await env.DB.prepare(
    `${REQUEST_SELECT} WHERE ${col} = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 200`
  ).bind(me.user_id).all();
  return json({ requests: results.map(toRequest) });
});
