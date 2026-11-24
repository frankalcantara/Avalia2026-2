export async function onRequestPost() {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    "discord_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
