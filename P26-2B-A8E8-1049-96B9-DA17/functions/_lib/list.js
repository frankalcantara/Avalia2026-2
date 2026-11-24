import { fail, json } from "./http.js";
import { SELECT_QUOTE, normalizeTag, parseCursor, parseId, parseLimit, toQuote } from "./quotes.js";

/** Lê ?tag= e ?collection= e acrescenta filtros fixos (valores sempre via bind). Retorna {response} se inválido. */
export function extraFilters(url, where, params) {
  const rawTag = url.searchParams.get("tag");
  if (rawTag !== null && rawTag !== "") {
    const tag = normalizeTag(rawTag);
    if (tag === null) return { response: fail(400, "Parâmetro inválido.", { tag: "Tag inválida." }) };
    where.push("q.id IN (SELECT quote_id FROM quote_tags WHERE tag = ?)");
    params.push(tag);
  }
  const rawCol = url.searchParams.get("collection");
  if (rawCol !== null && rawCol !== "") {
    const id = parseId(rawCol);
    if (id === null) return { response: fail(400, "Parâmetro inválido.", { collection: "Deve ser um inteiro positivo." }) };
    where.push("q.id IN (SELECT quote_id FROM collection_quotes WHERE collection_id = ?)");
    params.push(id);
  }
  return {};
}

/** Paginação por cursor (id DESC). where/params são fixos no servidor, nunca vindos do cliente. */
export async function listQuotes(env, url, where, params, viewerId = null) {
  const cursor = parseCursor(url.searchParams.get("cursor"));
  if (cursor === "invalid") return fail(400, "Cursor inválido.", { cursor: "Deve ser um inteiro positivo." });
  const limit = parseLimit(url.searchParams.get("limit"));
  const conds = [...where];
  const binds = [...params];
  if (cursor !== null) { conds.push("q.id < ?"); binds.push(cursor); }
  const sql = `${SELECT_QUOTE} WHERE ${conds.join(" AND ")} ORDER BY q.id DESC LIMIT ?`;
  binds.push(limit + 1);
  try {
    const res = await env.DB.prepare(sql).bind(...binds).all();
    const rows = res.results || [];
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return json({ ok: true, quotes: page.map((r) => toQuote(r, viewerId)), nextCursor });
  } catch {
    return fail(500, "Erro interno ao consultar o acervo.");
  }
}
