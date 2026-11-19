import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { parseId } from "../../_lib/quotes.js";
import { countOf, isUnique, loadOwned, validateName } from "../../_lib/collections.js";

export async function onRequest({ request, env, params }) {
  const method = request.method;
  if (method !== "PUT" && method !== "DELETE") return methodNotAllowed(["PUT", "DELETE"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const id = parseId(params.id);
  if (id === null) return fail(404, "Coleção não encontrada.");

  let name;
  if (method === "PUT") {
    const parsed = await readJson(request);
    if (parsed.response) return parsed.response;
    const v = validateName(parsed.body);
    if (v.fields) return fail(400, "Dados inválidos.", v.fields);
    name = v.name;
  }
  try {
    const own = await loadOwned(env, id, user.userId);
    if (own.response) return own.response;
    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM collection_quotes WHERE collection_id = ?").bind(id),
        env.DB.prepare("DELETE FROM collections WHERE id = ? AND user_id = ?").bind(id, user.userId),
      ]);
      return json({ ok: true });
    }
    await env.DB.prepare("UPDATE collections SET name = ? WHERE id = ? AND user_id = ?").bind(name, id, user.userId).run();
    return json({ ok: true, collection: { id, name, count: await countOf(env, id) } });
  } catch (e) {
    if (isUnique(e)) return fail(409, "Você já tem uma coleção com esse nome.", { name: "Nome já em uso." });
    return fail(500, "Erro interno ao processar a coleção.");
  }
}
