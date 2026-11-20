import { HttpError, cleanText, json, myList, myLists, readBody, requireUser, shareCode } from "../_lib.js";

// GET /api/lists → { lists }
export async function onRequestGet({ request, env }) {
  const uid = await requireUser(request, env);
  return json({ lists: await myLists(env, uid) });
}

// POST /api/lists { name } → 201 { list }; criador vira owner na mesma transação.
export async function onRequestPost({ request, env }) {
  const uid = await requireUser(request, env);
  const name = cleanText((await readBody(request)).name, 80, "name");

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = shareCode();
    try {
      const [created] = await env.DB.batch([
        env.DB.prepare("INSERT INTO lists (name, share_code, owner_id) VALUES (?, ?, ?) RETURNING id").bind(name, code, uid),
        env.DB.prepare("INSERT INTO list_members (list_id, user_id, role) SELECT id, ?, 'owner' FROM lists WHERE share_code = ?").bind(uid, code),
      ]);
      return json({ list: await myList(env, uid, created.results[0].id) }, 201);
    } catch (err) {
      if (!/UNIQUE/i.test(String(err && err.message))) throw err;
      // colisão do share_code: tenta outro código
    }
  }
  throw new HttpError(409, "Não foi possível gerar um código único. Tente de novo.");
}

export { methodNotAllowed as onRequest } from "../_lib.js";
