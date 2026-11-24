export async function onRequestPost({ request, env }) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  if (m) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(m[1]).run();
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure" },
  });
}
