import { clearCookie, SESSION_COOKIE } from "../../_lib/session.js";

export async function onRequestPost({ request }) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie(request, SESSION_COOKIE),
    },
  });
}
