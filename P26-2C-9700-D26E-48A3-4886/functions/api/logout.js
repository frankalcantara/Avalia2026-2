export async function onRequestPost({ request }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return new Response(null, { status: 403 });
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": `kudos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` },
  });
}
