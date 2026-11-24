import { assertSessionSecret, readSession } from "./session.js";

export async function requireSession(request, env) {
  try {
    assertSessionSecret(env.SESSION_SECRET);
  } catch (error) {
    return {
      user: null,
      response: Response.json(
        { ok: false, error: "session_signing_not_configured" },
        { status: 503 },
      ),
    };
  }

  const user = await readSession(request, env.SESSION_SECRET);
  if (!user) {
    return {
      user: null,
      response: Response.json({ ok: false, error: "authentication_required" }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export async function readJsonBody(request) {
  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > 16384) {
    return {
      body: null,
      response: Response.json({ ok: false, error: "request_too_large" }, { status: 413 }),
    };
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return {
      body: null,
      response: Response.json({ ok: false, error: "invalid_json" }, { status: 400 }),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      body: null,
      response: Response.json({ ok: false, error: "invalid_json" }, { status: 400 }),
    };
  }
  return { body, response: null };
}

export function methodNotAllowed(allow) {
  return Response.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: allow } },
  );
}
