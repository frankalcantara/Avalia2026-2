import { clearSessionCookie, clearStateCookie } from "../../_shared/session.js";
import { json } from "../../_shared/http.js";

export function onRequestPost() {
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie());
  response.headers.append("Set-Cookie", clearStateCookie());
  return response;
}
