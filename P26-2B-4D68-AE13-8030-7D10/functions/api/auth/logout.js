import { errorResponse, isSameOrigin, json, readJson } from "../../_lib/http.js";
import { clearedCookie, SESSION_COOKIE } from "../../_lib/session.js";

export async function onRequestPost({ request }) {
  if (!isSameOrigin(request)) return errorResponse("Origem inválida.", 403);
  if (!await readJson(request)) return errorResponse("Requisição JSON inválida.");
  return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(SESSION_COOKIE, request) });
}
