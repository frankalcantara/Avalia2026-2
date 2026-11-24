import { json, lerCookie, cookie } from "../../_util.js";

export async function onRequestPost({ request, env }) {
  try {
    const sid = lerCookie(request, "sid");
    if (sid) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(sid).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("sid", "", 0) });
  } catch (err) {
    console.error(err);
    return json({ erro: "erro_interno" }, 500);
  }
}
