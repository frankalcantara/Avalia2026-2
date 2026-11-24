import {
  BOOKMARK_FIELDS, bookmarkBody, bookmarkData, columns, data, deleted,
  found, query, route, uuid,
} from "../../../lib/api.js";

export const onRequest = route(["GET", "PATCH", "DELETE"], async (context) => {
  const { request, env } = context;
  const id = uuid(context.params.id);
  const userId = context.data.user.user_id;
  query(request);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT ${columns(BOOKMARK_FIELDS)} FROM bookmarks WHERE id = ? AND user_id = ?`
    ).bind(id, userId).first();
    return data(bookmarkData(found(row)));
  }

  if (request.method === "DELETE") {
    const row = await env.DB.prepare(
      "DELETE FROM bookmarks WHERE id = ? AND user_id = ? RETURNING id"
    ).bind(id, userId).first();
    found(row);
    return deleted();
  }

  const body = await bookmarkBody(request, true);
  const entries = Object.entries(body);
  const assignments = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  const conditions = ["id = ?", "user_id = ?"];
  values.push(id, userId);
  if (Object.hasOwn(body, "collection_id")) {
    conditions.push("EXISTS (SELECT 1 FROM collections AS c WHERE c.id = ? AND c.user_id = bookmarks.user_id)");
    values.push(body.collection_id);
  }
  const row = await env.DB.prepare(
    `UPDATE bookmarks SET ${assignments.join(", ")}, updated_at = unixepoch()
     WHERE ${conditions.join(" AND ")} RETURNING ${columns(BOOKMARK_FIELDS)}`
  ).bind(...values).first();
  return data(bookmarkData(found(row)));
});
