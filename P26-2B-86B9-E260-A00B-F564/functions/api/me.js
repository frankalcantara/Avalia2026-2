/**
 * Cloudflare Pages Function — GET /api/me
 * Devolve o usuário autenticado a partir do cookie de sessão assinado.
 */
import { getSession, json } from "./_lib.js";

export async function onRequestGet(context) {
  const session = await getSession(context.request, context.env);
  if (!session) {
    return json({ ok: true, authenticated: false, user: null });
  }

  return json({
    ok: true,
    authenticated: true,
    user: {
      userId: session.userId,
      username: session.username,
      avatar: session.avatar,
    },
  });
}
