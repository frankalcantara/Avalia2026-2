function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function onRequest({ request }) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Use GET para esta rota." } },
      405,
      { Allow: "GET" },
    );
  }

  return jsonResponse({ status: "ok", service: "soundroom" });
}
