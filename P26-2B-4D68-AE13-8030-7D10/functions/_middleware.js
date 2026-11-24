// Roda em toda Pages Function: nunca deixa um erro escapar como 500 mudo.
export async function onRequest(context) {
  const { request, next } = context;
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);

  try {
    const response = await next();
    if (response.status >= 500) {
      console.error(JSON.stringify({
        level: "error",
        requestId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        ms: Date.now() - started,
      }));
    }
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      requestId,
      method: request.method,
      path: url.pathname,
      status: 500,
      ms: Date.now() - started,
      message: error?.message || String(error),
      stack: error?.stack || "",
    }));
    return Response.json(
      { ok: false, error: `Erro interno. Tente novamente (ref. ${requestId}).`, requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
