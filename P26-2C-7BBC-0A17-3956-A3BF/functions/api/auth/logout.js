export async function onRequestGet() {
  const opts = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", `discord_session=; ${opts}`);
  headers.append("Set-Cookie", `discord_session_sig=; ${opts}`);
  return new Response(null, { status: 302, headers });
}