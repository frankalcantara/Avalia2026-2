/**
 * Cloudflare Pages Function — /api/links
 *   GET  ?collection_id=&status= → lista os links do usuário (filtros opcionais e combináveis)
 *   POST → cria link { collection_id, url, title, summary?, status? }
 * O user_id vem sempre da sessão; qualquer user_id no corpo é ignorado.
 */
import {
  LINK_COLUMNS,
  parseId,
  readJson,
  requireOwnedCollection,
  route,
  validateCollectionId,
  validateStatus,
  validateSummary,
  validateTitle,
  validateUrl,
  ApiError,
} from "../../_lib/api.js";
import { sqlTimestamp } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

async function list({ env, user, url }) {
  const where = ["user_id = ?"];
  const values = [user.user_id];

  // Parâmetro ausente ou vazio (?status=) = sem filtro; valor preenchido e inválido = 400.
  const rawCollection = url.searchParams.get("collection_id");
  if (rawCollection) {
    const collectionId = parseId(rawCollection);
    if (collectionId === null) throw new ApiError(400, "collection_id inválido");
    await requireOwnedCollection(env, user.user_id, collectionId);
    where.push("collection_id = ?");
    values.push(collectionId);
  }

  const rawStatus = url.searchParams.get("status");
  if (rawStatus) {
    where.push("status = ?");
    values.push(validateStatus(rawStatus));
  }

  const { results } = await env.DB.prepare(`SELECT ${LINK_COLUMNS} FROM links WHERE ${where.join(" AND ")} ORDER BY id DESC`)
    .bind(...values)
    .all();
  return json({ links: results });
}

async function create({ request, env, user }) {
  const body = await readJson(request);

  const collectionId = validateCollectionId(body.collection_id);
  const linkUrl = validateUrl(body.url);
  const title = validateTitle(body.title);
  const summary = body.summary === undefined ? "" : validateSummary(body.summary);
  const status = body.status === undefined ? "Para Ler" : validateStatus(body.status);

  await requireOwnedCollection(env, user.user_id, collectionId);

  const now = sqlTimestamp();
  const row = await env.DB.prepare(
    "INSERT INTO links (user_id, collection_id, url, title, summary, status, created_at, updated_at) " +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${LINK_COLUMNS}`
  )
    .bind(user.user_id, collectionId, linkUrl, title, summary, status, now, now)
    .first();

  return json({ link: row }, 201);
}

export const onRequest = route({ GET: list, POST: create });