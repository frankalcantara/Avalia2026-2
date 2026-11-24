import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { SELECT_QUOTE, parseId, tagStatements, toQuote, validateQuote } from "../../_lib/quotes.js";

export async function onRequest({ request, env, params }) {
  const method = request.method;
  if (method !== "PUT" && method !== "DELETE") return methodNotAllowed(["PUT", "DELETE"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const id = parseId(params.id);
  if (id === null) return fail(404, "Citação não encontrada.");

  let value;
  if (method === "PUT") {
    const parsed = await readJson(request);
    if (parsed.response) return parsed.response;
    const v = validateQuote(parsed.body);
    if (v.fields) return fail(400, "Dados inválidos.", v.fields);
    value = v.value;
  }

  try {
    const existing = await env.DB.prepare("SELECT user_id, is_public FROM quotes WHERE id = ?").bind(id).first();
    if (!existing) return fail(404, "Citação não encontrada.");
    if (existing.user_id !== user.userId) return fail(403, "Você não pode alterar a citação de outro usuário.");

    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM quotes WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
      return json({ ok: true });
    }
    await env.DB.prepare(
      "UPDATE quotes SET text = ?, author = ?, work = ?, page = ?, reflection = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ).bind(value.text, value.author, value.work, value.page, value.reflection, value.isPublic ?? existing.is_public, id, user.userId).run();
    if (value.tags !== null) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM quote_tags WHERE quote_id = ?").bind(id),
        ...tagStatements(env.DB, id, value.tags),
      ]);
    }
    const row = await env.DB.prepare(`${SELECT_QUOTE} WHERE q.id = ?`).bind(id).first();
    if (!row) return fail(404, "Citação não encontrada.");
    return json({ ok: true, quote: toQuote(row, user.userId) });
  } catch {
    return fail(500, "Erro interno ao processar a citação.");
  }
}
