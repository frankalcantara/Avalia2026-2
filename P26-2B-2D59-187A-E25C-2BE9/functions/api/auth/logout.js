import { clearAuthCookies, json, methodNotAllowed } from "../../_shared/auth.js";

export async function onRequest({ request }) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const headers = new Headers();
  clearAuthCookies(headers);
  return json({ ok: true }, 200, headers);
}
