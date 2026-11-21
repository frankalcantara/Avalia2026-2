export async function onRequestPost({ request, env }) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|; )sid=([\w-]+)/);
  if (m) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(m[1]).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": "sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" },
  });
}
