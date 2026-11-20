import { json, fail, getCookie, sha256, cookie, sameOrigin } from "../../../lib/util.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail("Origem não permitida.", 403);
  const sid = getCookie(request, "sid");
  if (sid) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(sid)).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookie("sid", "", 0) });
}
