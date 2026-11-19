import { fail, json, methodNotAllowed, readJson, sameOriginOk } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { SELECT_QUOTE, tagStatements, toQuote, validateQuote } from "../../_lib/quotes.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  if (!sameOriginOk(request)) return fail(403, "Origem não permitida.");
  const parsed = await readJson(request);
  if (parsed.response) return parsed.response;
  const v = validateQuote(parsed.body);
  if (v.fields) return fail(400, "Dados inválidos.", v.fields);
  const q = v.value;
  try {
    // Garante a FK: o usuário da sessão existe em discord_users.
    await env.DB.prepare(
      "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING"
    ).bind(user.userId, user.username, user.avatar).run();
    const ins = await env.DB.prepare(
      "INSERT INTO quotes (user_id, text, author, work, page, reflection, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(user.userId, q.text, q.author, q.work, q.page, q.reflection, q.isPublic ?? 0).run();
    const id = ins.meta?.last_row_id;
    if (q.tags && q.tags.length) {
      try {
        await env.DB.batch(tagStatements(env.DB, id, q.tags));
      } catch (e) {
        await env.DB.prepare("DELETE FROM quotes WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
        throw e;
      }
    }
    const row = await env.DB.prepare(`${SELECT_QUOTE} WHERE q.id = ?`).bind(id).first();
    return json({ ok: true, quote: toQuote(row, user.userId) }, 201);
  } catch {
    return fail(500, "Erro interno ao salvar a citação.");
  }
}
