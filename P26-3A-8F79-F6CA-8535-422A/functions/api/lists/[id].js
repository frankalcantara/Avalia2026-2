import { HttpError, json, listTasks, myList, requireUser, routeId } from "../../_lib.js";

// GET /api/lists/:id → { list, members, tasks }
export async function onRequestGet({ request, env, params }) {
  const uid = await requireUser(request, env);
  const id = routeId(params);
  const list = await myList(env, uid, id);
  if (!list) throw new HttpError(404, "Lista não encontrada.");

  const { results } = await env.DB.prepare(
    `SELECT u.user_id, u.username, u.avatar, m.role FROM list_members m
     JOIN users u ON u.user_id = m.user_id WHERE m.list_id = ? ORDER BY m.joined_at, u.username`
  ).bind(id).all();
  const members = results.map((r) => ({ id: r.user_id, username: r.username, avatarUrl: r.avatar, role: r.role }));

  return json({ list, members, tasks: await listTasks(env, id) });
}

export { methodNotAllowed as onRequest } from "../../_lib.js";
