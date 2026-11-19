import { fail, json, methodNotAllowed } from "../_lib/http.js";
import { getSessionUser } from "../_lib/session.js";

// Tags das citações do próprio usuário, com contagem.
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  try {
    const res = await env.DB.prepare(
      "SELECT t.tag AS tag, COUNT(*) AS count FROM quote_tags t JOIN quotes q ON q.id = t.quote_id WHERE q.user_id = ? GROUP BY t.tag ORDER BY count DESC, t.tag ASC"
    ).bind(user.userId).all();
    return json({ ok: true, tags: (res.results || []).map((r) => ({ tag: r.tag, count: r.count })) });
  } catch {
    return fail(500, "Erro interno ao consultar as tags.");
  }
}
