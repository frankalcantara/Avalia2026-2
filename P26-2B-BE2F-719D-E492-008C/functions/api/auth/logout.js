export async function onRequestPost() {
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': 'sessao=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' },
  });
}