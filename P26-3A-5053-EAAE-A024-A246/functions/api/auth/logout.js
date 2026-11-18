import { buildCookie, json } from "../../_lib/session.js";

export async function onRequestPost({ request }) {
  return json(
    { ok: true, data: null },
    200,
    { "Set-Cookie": buildCookie(request, "session", "", 0) },
  );
}
