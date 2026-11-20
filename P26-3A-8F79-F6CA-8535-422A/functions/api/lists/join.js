import { HttpError, json, myList, readBody, requireUser } from "../../_lib.js";

// POST /api/lists/join { code } → { list }; já membro → 200 sem duplicar.
export async function onRequestPost({ request, env }) {
  const uid = await requireUser(request, env);
  const { code } = await readBody(request);
  if (typeof code !== "string" || !code.trim()) throw new HttpError(400, "Informe o código da lista.");

  const list = await env.DB.prepare("SELECT id FROM lists WHERE share_code = ?").bind(code.trim().toUpperCase()).first();
  if (!list) throw new HttpError(404, "Código de lista não encontrado.");

  await env.DB.prepare("INSERT OR IGNORE INTO list_members (list_id, user_id, role) VALUES (?, ?, 'member')")
    .bind(list.id, uid).run();
  return json({ list: await myList(env, uid, list.id) });
}

export { methodNotAllowed as onRequest } from "../../_lib.js";
