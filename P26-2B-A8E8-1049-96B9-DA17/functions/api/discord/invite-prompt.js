import { fail, methodNotAllowed, readJson, sameOriginOk } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";

/** POST /api/discord/invite-prompt {action:"accepted"|"dismissed"} -> 204. Marca a pergunta como vista. */
export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  const { body, response } = await readJson(request);
  if (response) return response;
  if (body.action !== "accepted" && body.action !== "dismissed") {
    return fail(400, "Dados inválidos.", { action: "Use 'accepted' ou 'dismissed'." });
  }
  try {
    await env.DB.prepare(
      "UPDATE discord_users SET invite_prompt_seen_at = COALESCE(invite_prompt_seen_at, CURRENT_TIMESTAMP) WHERE user_id = ?"
    ).bind(user.userId).run();
  } catch {
    return fail(500, "Erro interno.");
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
