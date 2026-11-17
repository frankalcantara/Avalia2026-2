// POST /api/auth/logout — apaga o cookie de sessão
export async function onRequestPost() {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "discord_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}