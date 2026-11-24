/**
 * Cloudflare Pages Function — /api/links/:id
 *   PATCH  → altera campos { collection_id?, url?, title?, summary?, status? }
 *   DELETE → exclui o link
 * Só opera em links do usuário da sessão; link de outro usuário → 404.
 */
import {
  ApiError,
  LINK_COLUMNS,
  readJson,
  requireId,
  requireOwnedCollection,
  route,
  validateCollectionId,
  validateStatus,
  validateSummary,
  validateTitle,
  validateUrl,
} from "../../_lib/api.js";
import { sqlTimestamp } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

async function update({ request, env, user, params }) {
  const id = requireId(params.id);
  const body = await readJson(request);

  // Primeiro toda a validação que não depende do banco.
  const sets = [];
  const values = [];
  let collectionId = null;
  if (body.collection_id !== undefined) {
    collectionId = validateCollectionId(body.collection_id);
    sets.push("collection_id = ?");
    values.push(collectionId);
  }
  if (body.url !== undefined) {
    sets.push("url = ?");
    values.push(validateUrl(body.url));
  }
  if (body.title !== undefined) {
    sets.push("title = ?");
    values.push(validateTitle(body.title));
  }
  if (body.summary !== undefined) {
    sets.push("summary = ?");
    values.push(validateSummary(body.summary));
  }
  if (body.status !== undefined) {
    sets.push("status = ?");
    values.push(validateStatus(body.status));
  }
  if (sets.length === 0) {
    throw new ApiError(400, "Informe ao menos um campo: collection_id, url, title, summary ou status");
  }

  // Mover o link: a coleção de destino também precisa ser do usuário.
  if (collectionId !== null) await requireOwnedCollection(env, user.user_id, collectionId);

  sets.push("updated_at = ?");
  values.push(sqlTimestamp());

  // Os fragmentos de SQL acima são constantes; todos os valores vão por bind().
  const row = await env.DB.prepare(`UPDATE links SET ${sets.join(", ")} WHERE id = ? AND user_id = ? RETURNING ${LINK_COLUMNS}`)
    .bind(...values, id, user.user_id)
    .first();
  if (!row) throw new ApiError(404, "Link não encontrado");

  return json({ link: row });
}

async function remove({ env, user, params }) {
  const id = requireId(params.id);
  const result = await env.DB.prepare("DELETE FROM links WHERE id = ? AND user_id = ?").bind(id, user.user_id).run();
  if (!result.meta || result.meta.changes === 0) throw new ApiError(404, "Link não encontrado");
  return json({ ok: true });
}

export const onRequest = route({ PATCH: update, DELETE: remove });