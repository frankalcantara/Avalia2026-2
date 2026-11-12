import {
  BOOKMARK_FIELDS, bookmarkData, columns, data, fail, limit, query, route, status, uuid,
} from "../../../../../lib/api.js";

export const onRequest = route(["GET"], async (context) => {
  const params = query(context.request, ["status", "limit"]);
  const max = limit(params);
  const id = uuid(context.params.id);
  const readStatus = params.has("status") ? status(params.get("status")) : null;
  const statusCondition = readStatus ? "AND b.status = ?" : "";
  const values = readStatus ? [readStatus, id, max] : [id, max];
  // LEFT JOIN distingue coleção pública vazia (uma linha sem link) de privada (nenhuma).
  // A visibilidade é verificada na própria consulta que lê os links, sem janela entre consultas.
  const result = await context.env.DB.prepare(
    `SELECT c.id AS public_collection_id, ${columns(BOOKMARK_FIELDS, "b")}
     FROM collections AS c LEFT JOIN bookmarks AS b
       ON b.collection_id = c.id AND b.user_id = c.user_id ${statusCondition}
     WHERE c.id = ? AND c.is_public = 1
     ORDER BY b.created_at DESC, b.id DESC LIMIT ?`
  ).bind(...values).all();
  if (!result.results.length) fail(404, "not_found", "Recurso não encontrado.");
  return data(result.results.filter((row) => row.id !== null).map(bookmarkData));
}, { public: true });
