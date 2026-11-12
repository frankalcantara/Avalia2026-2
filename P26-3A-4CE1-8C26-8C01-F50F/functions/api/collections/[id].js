import {
  COLLECTION_FIELDS, collectionBody, collectionData, columns, data, deleted,
  fail, found, query, route, uuid,
} from "../../../lib/api.js";

export const onRequest = route(["GET", "PATCH", "DELETE"], async (context) => {
  const { request, env } = context;
  const id = uuid(context.params.id);
  const userId = context.data.user.user_id;
  query(request);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT ${columns(COLLECTION_FIELDS)} FROM collections WHERE id = ? AND user_id = ?`
    ).bind(id, userId).first();
    return data(collectionData(found(row)));
  }

  if (request.method === "DELETE") {
    try {
      const row = await env.DB.prepare(
        "DELETE FROM collections WHERE id = ? AND user_id = ? RETURNING id"
      ).bind(id, userId).first();
      found(row);
      return deleted();
    } catch (error) {
      if (/FOREIGN KEY constraint failed/i.test(String(error?.message))) {
        fail(409, "collection_not_empty", "Mova ou exclua os links antes de excluir a coleção.");
      }
      throw error;
    }
  }

  const body = await collectionBody(request, true);
  // Os nomes das colunas vêm exclusivamente do validador de campos permitidos.
  const entries = Object.entries(body);
  const assignments = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([key, value]) => key === "is_public" ? Number(value) : value);
  const row = await env.DB.prepare(
    `UPDATE collections SET ${assignments.join(", ")}, updated_at = unixepoch()
     WHERE id = ? AND user_id = ? RETURNING ${columns(COLLECTION_FIELDS)}`
  ).bind(...values, id, userId).first();
  return data(collectionData(found(row)));
});
