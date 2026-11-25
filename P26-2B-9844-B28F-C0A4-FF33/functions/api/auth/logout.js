import { json } from "../../_shared/http.js";
import { clearSessionCookie } from "../../_shared/session.js";

export async function onRequestPost({ request }) {
  return json({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(request),
  });
}
