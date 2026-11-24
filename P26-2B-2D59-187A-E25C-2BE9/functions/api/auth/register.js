import {
  getSessionSecret,
  hashPassword,
  json,
  makeSessionCookie,
  methodNotAllowed,
  normalizeEmail,
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
    return json({ error: "O corpo deve ser um objeto JSON." }, 400);
  }

  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "E-mail inválido." }, 400);
  if (typeof body.username !== "string") {
    return json({ error: "Nome deve ter entre 2 e 80 caracteres." }, 400);
  }
  const username = body.username.trim();
  if (username.length < 2 || username.length > 80) {
    return json({ error: "Nome deve ter entre 2 e 80 caracteres." }, 400);
  }
  if (
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128
  ) {
    return json({ error: "Senha deve ter entre 12 e 128 caracteres." }, 400);
  }

  try {
    const secret = getSessionSecret(env);
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (existing) return json({ error: "E-mail já cadastrado." }, 409);

    const password = await hashPassword(body.password);
    const user = {
      user_id: `local:${crypto.randomUUID()}`,
      username,
      avatar: null,
    };
    const result = await env.DB.prepare(
      `INSERT INTO users (id, email, username, avatar, password_salt, password_hash, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO NOTHING`,
    ).bind(user.user_id, email, username, password.salt, password.hash).run();
    if (Number(result?.meta?.changes) !== 1) {
      return json({ error: "E-mail já cadastrado." }, 409);
    }

    const headers = new Headers();
    headers.append("Set-Cookie", await makeSessionCookie(user, secret));
    return json({
      authenticated: true,
      user: { id: user.user_id, username: user.username, avatar: user.avatar },
    }, 201, headers);
  } catch (error) {
    console.error("Could not register local user.", error);
    return json({ error: "Não foi possível concluir o cadastro." }, 500);
  }
}
