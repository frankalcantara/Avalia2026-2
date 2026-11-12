export function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

export function readCookie(request, name) {
  const prefix = name + "=";
  const cookie = request.headers.get("Cookie") || "";
  return cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(prefix))?.slice(prefix.length) || "";
}

export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function validOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export function appOrigin(request, env) {
  return env.APP_ORIGIN ? new URL(env.APP_ORIGIN).origin : new URL(request.url).origin;
}
