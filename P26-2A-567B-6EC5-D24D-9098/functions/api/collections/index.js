/**
 * Cloudflare Pages Function — /api/collections
 *   GET  → lista as coleções do usuário, com link_count
 *   POST → cria coleção { name, description? }
 */
import {
  ApiError,
  fetchCollection,
  isUniqueViolation,
  listCollections,
  readJson,
  route,
  validateDescription,
  validateName,
} from "../../_lib/api.js";
import { json } from "../../_lib/http.js";

async function list({ env, user }) {
  return json({ collections: await listCollections(env, user.user_id) });
}

async function create({ request, env, user }) {
  const body = await readJson(request);
  const name = validateName(body.name);
  const description = body.description === undefined ? "" : validateDescription(body.description);

  let row;
  try {
    row = await env.DB.prepare("INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?) RETURNING id")
      .bind(user.user_id, name, description)
      .first();
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Já existe uma coleção com esse nome");
    throw err;
  }

  return json({ collection: await fetchCollection(env, user.user_id, row.id) }, 201);
}

export const onRequest = route({ GET: list, POST: create });