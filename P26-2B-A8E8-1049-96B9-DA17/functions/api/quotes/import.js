import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { SELECT_QUOTE, chunk, dupKey, tagStatements, toQuote, validateQuote } from "../../_lib/quotes.js";

export const MAX_IMPORT_ITEMS = 200;
export const MAX_IMPORT_BYTES = 1024 * 1024;

// Importação em lote: tudo entra PRIVADO; duplicatas (texto+autor normalizados) são puladas.
export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const parsed = await readJson(request, MAX_IMPORT_BYTES);
  if (parsed.response) return parsed.response;
  const items = parsed.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return fail(400, "Dados inválidos.", { items: "Envie uma lista com ao menos 1 item." });
  }
  if (items.length > MAX_IMPORT_ITEMS) {
    return fail(400, "Dados inválidos.", { items: `Máximo de ${MAX_IMPORT_ITEMS} itens por importação.` });
  }

  try {
    const existing = await env.DB.prepare("SELECT text, author FROM quotes WHERE user_id = ?").bind(user.userId).all();
    const seen = new Set((existing.results || []).map((r) => dupKey(r.text, r.author)));

    const skipped = [];
    const toCreate = [];
    items.forEach((item, index) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        skipped.push({ index, reason: "invalid", fields: { item: "Deve ser um objeto." } });
        return;
      }
      // visibility/isPublic enviados pelo cliente são ignorados: tudo entra privado.
      const v = validateQuote({ ...item, visibility: undefined });
      if (v.fields) { skipped.push({ index, reason: "invalid", fields: v.fields }); return; }
      const key = dupKey(v.value.text, v.value.author);
      if (seen.has(key)) { skipped.push({ index, reason: "duplicate" }); return; }
      seen.add(key);
      toCreate.push(v.value);
    });

    const created = [];
    if (toCreate.length) {
      await env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING"
      ).bind(user.userId, user.username, user.avatar).run();
      const results = await env.DB.batch(toCreate.map((q) =>
        env.DB.prepare("INSERT INTO quotes (user_id, text, author, work, page, reflection, is_public) VALUES (?, ?, ?, ?, ?, ?, 0)")
          .bind(user.userId, q.text, q.author, q.work, q.page, q.reflection)
      ));
      const ids = results.map((r) => r.meta?.last_row_id);
      try {
        const stmts = toCreate.flatMap((q, i) => tagStatements(env.DB, ids[i], q.tags || []));
        for (const part of chunk(stmts, 100)) await env.DB.batch(part);
      } catch (e) {
        // desfaz o lote (tags caem em cascata)
        for (const part of chunk(ids, 100)) {
          await env.DB.batch(part.map((id) => env.DB.prepare("DELETE FROM quotes WHERE id = ? AND user_id = ?").bind(id, user.userId)));
        }
        throw e;
      }
      for (const part of chunk(ids, 50)) {
        const rows = await env.DB.prepare(`${SELECT_QUOTE} WHERE q.id IN (${part.map(() => "?").join(",")})`).bind(...part).all();
        created.push(...(rows.results || []));
      }
      created.sort((a, b) => a.id - b.id);
    }
    return json({ ok: true, created: created.length, skipped, quotes: created.map((r) => toQuote(r, user.userId)) });
  } catch {
    return fail(500, "Erro interno ao importar as citações.");
  }
}
