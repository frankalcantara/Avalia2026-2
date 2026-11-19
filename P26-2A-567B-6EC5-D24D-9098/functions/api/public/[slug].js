/**
 * Cloudflare Pages Function — GET /api/public/:slug  (sem login, somente leitura)
 * Só coleções com is_public = 1. Expõe apenas username e avatar do dono (nunca o user_id).
 */
import { ApiError, SLUG_PATTERN, avatarUrl, route } from "../../_lib/api.js";
import { json } from "../../_lib/http.js";

async function show({ env, params }) {
  const slug = typeof params.slug === "string" ? params.slug : "";
  // Slug fora do formato nem chega ao banco.
  if (!SLUG_PATTERN.test(slug)) throw new ApiError(404, "Coleção não encontrada");

  const collection = await env.DB.prepare(
    "SELECT c.id, c.name, c.description, u.user_id, u.username, u.avatar " +
      "FROM collections c JOIN discord_users u ON u.user_id = c.user_id " +
      "WHERE c.public_slug = ? AND c.is_public = 1"
  )
    .bind(slug)
    .first();
  if (!collection) throw new ApiError(404, "Coleção não encontrada");

  // Ordem de inclusão: a trilha de estudos aparece na sequência em que foi montada.
  const { results } = await env.DB.prepare(
    "SELECT url, title, summary, status FROM links WHERE collection_id = ? ORDER BY id ASC"
  )
    .bind(collection.id)
    .all();

  return json({
    collection: {
      name: collection.name,
      description: collection.description,
      owner: {
        username: collection.username,
        avatar: avatarUrl(collection.user_id, collection.avatar),
      },
    },
    links: results,
  });
}

export const onRequest = route({ GET: show }, { auth: false });