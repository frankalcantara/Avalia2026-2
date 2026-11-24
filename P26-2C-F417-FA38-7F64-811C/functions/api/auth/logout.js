import { clearCookie, isSecure } from "../_lib/http.js";
export async function onRequestPost({ request }) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "Set-Cookie": clearCookie("ct_session", isSecure(request))
    }
  });
}
