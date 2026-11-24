export function onRequest() {
  return new Response(null, {
    status: 302,
    headers: { Location: "/", "Set-Cookie": "discord_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure" },
  });
}
