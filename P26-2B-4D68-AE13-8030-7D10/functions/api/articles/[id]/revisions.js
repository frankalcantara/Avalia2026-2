import { errorResponse, json, requireDatabase } from "../../../_lib/http.js";
import { listRevisions } from "../../../_lib/revisions.js";
import { getSession } from "../../../_lib/session.js";
import { isPositiveId } from "../../../_lib/validation.js";

// Histórico de edições: só o autor vê.
export async function onRequestGet({ request, env, params }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;

  const user = await getSession(request, env.SESSION_SECRET);
  if (!user) return errorResponse("Entre com Discord para ver o histórico.", 401);
  if (!isPositiveId(params.id)) return errorResponse("Artigo não encontrado.", 404);

  const owned = await env.DB.prepare("SELECT id FROM articles WHERE id = ? AND author_id = ?")
    .bind(params.id, user.userId).first();
  if (!owned) return errorResponse("Artigo não encontrado ou sem permissão.", 404);

  return json({ revisions: await listRevisions(env.DB, params.id) });
}
