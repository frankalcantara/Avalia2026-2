import { getSession, json, methodAllowed, withErrors } from "../_lib.js";
export const onRequest = withErrors(async ({ request, env }) => {
  methodAllowed(request, ["GET"]);
  const session = await getSession(request, env);
  return json(session ? { user: session.user, csrf_token: session.csrf_token } : { user: null });
});
