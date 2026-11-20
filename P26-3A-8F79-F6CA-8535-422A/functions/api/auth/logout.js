import { clearCookie } from "../../_lib.js";

// POST /api/auth/logout → 204 e apaga o cookie (idempotente: não exige sessão válida).
export function onRequestPost() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearCookie("session") } });
}

export { methodNotAllowed as onRequest } from "../../_lib.js";
