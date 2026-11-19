import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "../../../_lib/http.js";
import { getSessionUser } from "../../../_lib/session.js";
import { chunk, parseId } from "../../../_lib/quotes.js";
import { countOf, loadOwned } from "../../../_lib/collections.js";

const MAX_IDS = 2000;

// Substitui os membros da coleção (apenas citações do próprio usuário).
export async function onRequest({ request, env, params }) {
  if (request.method !== "PUT") return methodNotAllowed(["PUT"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const id = parseId(params.id);
  if (id === null) return fail(404, "Coleção não encontrada.");
  const parsed = await readJson(request);
  if (parsed.response) return parsed.response;
  const raw = parsed.body.quoteIds;
  if (!Array.isArray(raw) || raw.length > MAX_IDS) {
    return fail(400, "Dados inválidos.", { quoteIds: `Deve ser uma lista com até ${MAX_IDS} ids.` });
  }
  const ids = [];
  for (const v of raw) {
    const n = typeof v === "number" && Number.isInteger(v) && v > 0 ? v : typeof v === "string" ? parseId(v) : null;
    if (n === null) return fail(400, "Dados inválidos.", { quoteIds: "Cada id deve ser um inteiro positivo." });
    ids.push(n);
  }
  const unique = [...new Set(ids)];

  try {
    const own = await loadOwned(env, id, user.userId);
    if (own.response) return own.response;
    const mine = new Set();
    for (const part of chunk(unique, 50)) {
      const rows = await env.DB.prepare(
        `SELECT id FROM quotes WHERE user_id = ? AND id IN (${part.map(() => "?").join(",")})`
      ).bind(user.userId, ...part).all();
      for (const r of rows.results || []) mine.add(r.id);
    }
    if (mine.size !== unique.length) {
      return fail(400, "Dados inválidos.", { quoteIds: "Há citações inexistentes ou que não são suas." });
    }
    const stmts = [env.DB.prepare("DELETE FROM collection_quotes WHERE collection_id = ?").bind(id)];
    for (const part of chunk(unique, 49)) {
      stmts.push(env.DB.prepare(
        `INSERT OR IGNORE INTO collection_quotes (collection_id, quote_id) VALUES ${part.map(() => "(?, ?)").join(", ")}`
      ).bind(...part.flatMap((q) => [id, q])));
    }
    await env.DB.batch(stmts);
    return json({ ok: true, collection: { id, name: own.col.name, count: await countOf(env, id) } });
  } catch {
    return fail(500, "Erro interno ao processar a coleção.");
  }
}
