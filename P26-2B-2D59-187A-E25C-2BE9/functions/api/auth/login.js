import {
  getSessionSecret,
  json,
  makeSessionCookie,
  methodNotAllowed,
  normalizeEmail,
  verifyPassword,
} from "../../_shared/auth.js";

const MAX_BODY_BYTES = 8192;

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.DB) return json({ error: "Banco de dados indisponível." }, 503);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    return json({ error: "O corpo deve ser enviado como application/json." }, 400);
  }
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
    return json({ error: "Corpo da requisição muito grande." }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Credenciais inválidas." }, 401);
  }
  const email = normalizeEmail(body.email);
  if (
    !email ||
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128
  ) {
    return json({ error: "Credenciais inválidas." }, 401);
  }

  try {
    const secret = getSessionSecret(env);
    const user = await env.DB.prepare(
      `SELECT id, username, avatar, password_salt, password_hash
       FROM users WHERE email = ?`,
    ).bind(email).first();
    if (
      !user ||
      typeof user.password_salt !== "string" ||
      typeof user.password_hash !== "string" ||
      !(await verifyPassword(body.password, user.password_salt, user.password_hash))
    ) {
      return json({ error: "Credenciais inválidas." }, 401);
    }

    const sessionUser = {
      user_id: user.id,
      username: user.username,
      avatar: user.avatar,
    };
    const headers = new Headers();
    headers.append("Set-Cookie", await makeSessionCookie(sessionUser, secret));
    return json({
      authenticated: true,
      user: { id: user.id, username: user.username, avatar: user.avatar },
    }, 200, headers);
  } catch (error) {
    console.error("Could not authenticate local user.", error);
    return json({ error: "Não foi possível concluir a autenticação." }, 500);
  }
}
