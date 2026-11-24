import { cookie } from "../../_lib/sessao.js";

export async function onRequestPost() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie("discord_session", "", 0) } });
}
