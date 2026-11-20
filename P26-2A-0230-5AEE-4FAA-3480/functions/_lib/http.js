export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function database(env) {
  if (!env.DB) {
    throw new HttpError(503, "O banco de dados está indisponível.");
  }
  return env.DB;
}

export function redirect(request, destination, cookies = []) {
  const headers = new Headers({
    "Location": new URL(destination, request.url).href,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}
