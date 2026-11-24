import { logoutCookie } from "../../_lib/auth.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export async function onRequestPost() {
  return json({ ok: true }, 200, { "Set-Cookie": logoutCookie() });
}

export function onRequest({ request }) {
  return methodNotAllowed(["POST"]);
}
