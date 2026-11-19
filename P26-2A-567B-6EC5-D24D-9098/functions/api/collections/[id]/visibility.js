/**
 * Cloudflare Pages Function — PATCH /api/collections/:id/visibility  { is_public }
 *   true  → publica: gera public_slug aleatório e URL-safe (mantém o atual se já estiver pública)
 *   false → despublica: is_public = 0 e remove o slug (o link antigo deixa de funcionar)
 */
import {
  ApiError,
  fetchCollection,
  isUniqueViolation,
  randomSlug,
  readJson,
  requireId,
  route,
} from "../../../_lib/api.js";
import { json } from "../../../_lib/http.js";

async function setVisibility({ request, env, user, params }) {
  const id = requireId(params.id);
  const body = await readJson(request);

  let makePublic;
  if (body.is_public === true || body.is_public === 1) makePublic = true;
  else if (body.is_public === false || body.is_public === 0) makePublic = false;
  else throw new ApiError(400, "is_public deve ser true ou false");

  const current = await env.DB.prepare("SELECT is_public, public_slug FROM collections WHERE id = ? AND user_id = ?")
    .bind(id, user.user_id)
    .first();
  if (!current) throw new ApiError(404, "Coleção não encontrada");

  if (!makePublic) {
    await env.DB.prepare("UPDATE collections SET is_public = 0, public_slug = NULL WHERE id = ? AND user_id = ?")
      .bind(id, user.user_id)
      .run();
  } else if (!(current.is_public === 1 && current.public_slug)) {
    // public_slug é UNIQUE: em caso (praticamente impossível) de colisão, tenta de novo.
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      try {
        await env.DB.prepare("UPDATE collections SET is_public = 1, public_slug = ? WHERE id = ? AND user_id = ?")
          .bind(randomSlug(), id, user.user_id)
          .run();
        saved = true;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    if (!saved) throw new ApiError(500, "Não foi possível gerar o link público");
  }

  return json({ collection: await fetchCollection(env, user.user_id, id) });
}

export const onRequest = route({ PATCH: setVisibility });