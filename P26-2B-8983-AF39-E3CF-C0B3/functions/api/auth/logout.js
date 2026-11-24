import { clearSessionCookie, fail, json, methodNotAllowed } from "../../_utils.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return methodNotAllowed("POST");
  try {
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  } catch (error) {
    return fail(error);
  }
}
