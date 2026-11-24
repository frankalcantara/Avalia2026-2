import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { isUnique, validateName } from "../../_lib/collections.js";

export async function onRequest({ request, env }) {
  const method = request.method;
  if (method !== "GET" && method !== "POST") return methodNotAllowed(["GET", "POST"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  try {
    if (method === "GET") {
      const res = await env.DB.prepare(
        "SELECT c.id AS id, c.name AS name, (SELECT COUNT(*) FROM collection_quotes cq WHERE cq.collection_id = c.id) AS count " +
        "FROM collections c WHERE c.user_id = ? ORDER BY c.name COLLATE NOCASE ASC, c.id ASC"
      ).bind(user.userId).all();
      return json({ ok: true, collections: (res.results || []).map((r) => ({ id: r.id, name: r.name, count: r.count })) });
    }
    if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
    const parsed = await readJson(request);
    if (parsed.response) return parsed.response;
    const v = validateName(parsed.body);
    if (v.fields) return fail(400, "Dados inválidos.", v.fields);
    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING"
    ).bind(user.userId, user.username, user.avatar).run();
    const ins = await env.DB.prepare("INSERT INTO collections (user_id, name) VALUES (?, ?)").bind(user.userId, v.name).run();
    return json({ ok: true, collection: { id: ins.meta?.last_row_id, name: v.name, count: 0 } }, 201);
  } catch (e) {
    if (isUnique(e)) return fail(409, "Você já tem uma coleção com esse nome.", { name: "Nome já em uso." });
    return fail(500, "Erro interno ao processar a coleção.");
  }
}
