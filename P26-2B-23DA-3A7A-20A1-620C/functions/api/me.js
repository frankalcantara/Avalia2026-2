/**
 * GET /api/me - devolve o usuario logado (da sessao no D1) ou 401.
 */
import { getSessionUser } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json({ ok: false, error: "server_config" }, { status: 500 });
  }
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  return Response.json(
    {
      ok: true,
      user: { id: user.user_id, username: user.username, avatar: user.avatar },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}