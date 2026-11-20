import { HttpError, memberRole, requireUser, routeId } from "../../../../_lib.js";

// DELETE /api/lists/:id/members/:userId → 204. userId da sessão = sair; outro = remover (só o dono).
export async function onRequestDelete({ request, env, params }) {
  const uid = await requireUser(request, env);
  const listId = routeId(params);
  const target = params.userId || "";
  if (!/^\d{1,20}$/.test(target)) throw new HttpError(404, "Membro não encontrado."); // id do Discord

  const myRole = await memberRole(env, listId, uid);
  if (!myRole) throw new HttpError(404, "Lista não encontrada.");
  if (target === uid) {
    if (myRole === "owner") throw new HttpError(409, "O dono não pode sair da lista.");
  } else {
    if (myRole !== "owner") throw new HttpError(403, "Só o dono pode remover membros.");
    const role = await memberRole(env, listId, target);
    if (!role) throw new HttpError(404, "Membro não encontrado.");
    if (role === "owner") throw new HttpError(409, "O dono não pode ser removido.");
  }

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE tasks SET assignee_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE list_id = ? AND assignee_id = ?"
    ).bind(listId, target),
    env.DB.prepare("DELETE FROM list_members WHERE list_id = ? AND user_id = ?").bind(listId, target),
  ]);
  return new Response(null, { status: 204 });
}

export { methodNotAllowed as onRequest } from "../../../../_lib.js";
