export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders },
  });
}

export function route(handlers) {
  return async (context) => {
    if (!Object.hasOwn(handlers, context.request.method)) {
      return json({ error: "Método indisponível." }, 405, { Allow: Object.keys(handlers).join(", ") });
    }
    try {
      return await handlers[context.request.method](context);
    } catch (error) {
      if (error instanceof RequestError) return json({ error: error.message }, error.status);
      return json({ error: "Serviço temporariamente indisponível." }, 503);
    }
  };
}

export function database(env) {
  if (!env.DB) throw new RequestError("Banco de dados indisponível.", 503);
  return env.DB;
}

export function requireSameOrigin(request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    throw new RequestError("Origem não autorizada.", 403);
  }
}

export async function readJson(request, limit = 256 * 1024) {
  const type = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new RequestError("Envie um corpo JSON.", 415);
  if (Number(request.headers.get("Content-Length")) > limit) {
    throw new RequestError("Currículo excede o tamanho permitido.", 413);
  }
  if (!request.body) throw new RequestError("Corpo JSON inválido.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new RequestError("Currículo excede o tamanho permitido.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    await reader.cancel().catch(() => {});
    throw new RequestError("Corpo JSON inválido.");
  } finally {
    reader.releaseLock();
  }
}
