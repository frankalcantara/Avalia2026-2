import { json } from "../../../lib/util.js";

export async function onRequestPost() {
  return json({ ok: true }, 200, { "Set-Cookie": "sessao=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
}
