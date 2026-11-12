import {
  BOOKMARK_FIELDS, bookmarkBody, bookmarkData, columns, data, found,
  limit, query, route, status, uuid,
} from "../../lib/api.js";

export const onRequest = route(["GET", "POST"], async (context) => {
  const { request, env } = context;
  const userId = context.data.user.user_id;

  if (request.method === "GET") {
    const params = query(request, ["collection_id", "status", "limit"]);
    const max = limit(params);
    const collectionId = params.has("collection_id") ? uuid(params.get("collection_id"), "collection_id") : null;
    const readStatus = params.has("status") ? status(params.get("status")) : null;
    if (collectionId) {
      found(await env.DB.prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?")
        .bind(collectionId, userId).first());
    }
    const conditions = ["user_id = ?"];
    const values = [userId];
    if (collectionId) { conditions.push("collection_id = ?"); values.push(collectionId); }
    if (readStatus) { conditions.push("status = ?"); values.push(readStatus); }
    const result = await env.DB.prepare(
      `SELECT ${columns(BOOKMARK_FIELDS)} FROM bookmarks WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC, id DESC LIMIT ?`
    ).bind(...values, max).all();
    return data(result.results.map(bookmarkData));
  }

  query(request);
  const body = await bookmarkBody(request);
  // A coleção e o proprietário são verificados no mesmo comando que cria o link.
  const row = await env.DB.prepare(
    `INSERT INTO bookmarks (id, user_id, collection_id, url, title, summary, status)
     SELECT ?, c.user_id, c.id, ?, ?, ?, ? FROM collections AS c
     WHERE c.id = ? AND c.user_id = ? RETURNING ${columns(BOOKMARK_FIELDS)}`
  ).bind(crypto.randomUUID(), body.url, body.title, body.summary, body.status, body.collection_id, userId).first();
  return data(bookmarkData(found(row)), 201);
});
