import {
  COLLECTION_FIELDS, collectionData, columns, data, found, query, route, uuid,
} from "../../../../lib/api.js";

export const onRequest = route(["GET"], async (context) => {
  query(context.request);
  const row = await context.env.DB.prepare(
    `SELECT ${columns(COLLECTION_FIELDS)} FROM collections WHERE id = ? AND is_public = 1`
  ).bind(uuid(context.params.id)).first();
  return data(collectionData(found(row)));
}, { public: true });
