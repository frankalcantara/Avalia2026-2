import { authCookie, readSession, SESSION_COOKIE } from "../_lib/auth.js";
import { database } from "../_lib/http.js";

export async function onRequestPost({ request, env }) {
  const session = await readSession(request, env);
  if (session) {
    await database(env).prepare("DELETE FROM sessions WHERE id = ?").bind(session.id).run();
  }
  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": authCookie(request, SESSION_COOKIE, "", 0),
    },
  });
}
