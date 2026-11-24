export async function onRequestGet({ request }) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([^;]+)/);

  if (!match) {
    return Response.json({ authenticated: false }, { status: 200 });
  }

  try {
    const user = JSON.parse(decodeURIComponent(atob(match[1])));
    return Response.json({ authenticated: true, user }, { status: 200 });
  } catch {
    return Response.json({ authenticated: false }, { status: 200 });
  }
}

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    }
  });
}