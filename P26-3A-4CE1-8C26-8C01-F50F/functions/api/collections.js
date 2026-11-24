import {
  COLLECTION_FIELDS, collectionBody, collectionData, columns, data, query, route,
} from "../../lib/api.js";

export const onRequest = route(["GET", "POST"], async (context) => {
  const { request, env } = context;
  const userId = context.data.user.user_id;
  query(request);

  if (request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT ${columns(COLLECTION_FIELDS)} FROM collections
       WHERE user_id = ? ORDER BY created_at DESC, id DESC`
    ).bind(userId).all();
    return data(result.results.map(collectionData));
  }

  const body = await collectionBody(request);
  const row = await env.DB.prepare(
    `INSERT INTO collections (id, user_id, name, is_public) VALUES (?, ?, ?, ?)
     RETURNING ${columns(COLLECTION_FIELDS)}`
  ).bind(crypto.randomUUID(), userId, body.name, Number(body.is_public)).first();
  return data(collectionData(row), 201);
});
