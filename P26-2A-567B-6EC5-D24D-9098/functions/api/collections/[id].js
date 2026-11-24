/**
 * Cloudflare Pages Function — /api/collections/:id
 *   PATCH  → renomeia e/ou altera a descrição { name?, description? }
 *   DELETE → exclui a coleção e os links dela
 */
import {
  ApiError,
  fetchCollection,
  isUniqueViolation,
  readJson,
  requireId,
  route,
  validateDescription,
  validateName,
} from "../../_lib/api.js";
import { json } from "../../_lib/http.js";

async function update({ request, env, user, params }) {
  const id = requireId(params.id);
  const body = await readJson(request);

  const sets = [];
  const values = [];
  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(validateName(body.name));
  }
  if (body.description !== undefined) {
    sets.push("description = ?");
    values.push(validateDescription(body.description));
  }
  if (sets.length === 0) throw new ApiError(400, "Informe name e/ou description");

  let row;
  try {
    // Os fragmentos de SQL acima são constantes; todos os valores vão por bind().
    row = await env.DB.prepare(`UPDATE collections SET ${sets.join(", ")} WHERE id = ? AND user_id = ? RETURNING id`)
      .bind(...values, id, user.user_id)
      .first();
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Já existe uma coleção com esse nome");
    throw err;
  }
  if (!row) throw new ApiError(404, "Coleção não encontrada");

  return json({ collection: await fetchCollection(env, user.user_id, id) });
}

async function remove({ env, user, params }) {
  const id = requireId(params.id);

  const owned = await env.DB.prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?")
    .bind(id, user.user_id)
    .first();
  if (!owned) throw new ApiError(404, "Coleção não encontrada");

  // Os links também caem pelo ON DELETE CASCADE; o DELETE explícito não depende disso.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM links WHERE collection_id = ? AND user_id = ?").bind(id, user.user_id),
    env.DB.prepare("DELETE FROM collections WHERE id = ? AND user_id = ?").bind(id, user.user_id),
  ]);
  return json({ ok: true });
}

export const onRequest = route({ PATCH: update, DELETE: remove });