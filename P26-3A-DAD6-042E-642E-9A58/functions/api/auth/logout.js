import { assertOrigin } from "../../_shared/auth.js";
import { clearSessionCookie } from "../../_shared/cookies.js";
import { handle, methodNotAllowed, noContent } from "../../_shared/http.js";
import { deleteSession } from "../../_shared/session.js";

// POST /api/auth/logout -> 204 (idempotente: sem sessão também responde 204).
export const onRequestPost = handle("logout", async ({ request, env }) => {
  assertOrigin(request, env);
  await deleteSession(request, env);
  return noContent([clearSessionCookie()]);
});

export function onRequest() {
  return methodNotAllowed("POST");
}
