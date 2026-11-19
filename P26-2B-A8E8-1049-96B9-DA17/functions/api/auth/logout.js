import { isHttps, json, methodNotAllowed, fail, sameOriginOk } from "../../_lib/http.js";
import { SESSION_COOKIE, buildCookie } from "../../_lib/session.js";

export async function onRequest({ request }) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  return json({ ok: true }, 200, {
    "Set-Cookie": buildCookie(SESSION_COOKIE, "", { maxAge: 0, secure: isHttps(request) }),
  });
}
