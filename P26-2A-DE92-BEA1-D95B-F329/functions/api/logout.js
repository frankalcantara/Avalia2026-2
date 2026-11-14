import { cookie, json, methodAllowed, requireCsrf, requireDb, requireSession, SESSION_COOKIE, withErrors } from "../_lib.js";
export const onRequest = withErrors(async ({ request, env }) => {
  methodAllowed(request, ["POST"]);
  const session = await requireSession(request, env);
  requireCsrf(request, session);
  await requireDb(env).prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.token_hash).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION_COOKIE, "", 0) });
});
