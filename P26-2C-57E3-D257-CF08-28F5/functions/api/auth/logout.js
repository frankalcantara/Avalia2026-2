import { clearSessionCookie } from "../../_shared/session.js";
import { json } from "../../_shared/http.js";

export function onRequestPost() {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
