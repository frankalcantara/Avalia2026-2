import { getSession } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getSession(request, env);
  return Response.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function onRequestPost() {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", "discord_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
