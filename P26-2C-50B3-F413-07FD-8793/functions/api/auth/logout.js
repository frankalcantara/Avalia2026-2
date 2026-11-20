/** POST /api/auth/logout — apaga o cookie de sessão. */
import { clearSessionCookie } from "../../_lib/session.js";

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
