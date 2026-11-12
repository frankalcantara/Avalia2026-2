import { deleteSession, SESSION_COOKIE } from "../../lib/auth.js";
import { cookie, json, validOrigin } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!validOrigin(request)) return json({ error: "Origem não permitida." }, 403);
  if (!env.DB) return json({ error: "Serviço indisponível." }, 503);
  await deleteSession(request, env);
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": cookie(SESSION_COOKIE, "", 0),
    },
  });
}
