import { HttpError, checkAssignee, cleanText, getTask, json, memberRole, readBody, requireUser, routeId } from "../../_lib.js";

// Carrega a tarefa e confere se o usuário é membro da lista dela (404 se não, para não revelar).
async function loadTask(request, env, params) {
  const uid = await requireUser(request, env);
  const id = routeId(params);
  const task = await env.DB.prepare("SELECT id, list_id FROM tasks WHERE id = ?").bind(id).first();
  if (!task || !(await memberRole(env, task.list_id, uid))) throw new HttpError(404, "Tarefa não encontrada.");
  return task;
}

// PATCH /api/tasks/:id { title?, done?, assigneeId? } → { task }
export async function onRequestPatch({ request, env, params }) {
  const task = await loadTask(request, env, params);
  const body = await readBody(request);

  const sets = [];
  const values = [];
  if ("title" in body) {
    sets.push("title = ?");
    values.push(cleanText(body.title, 200, "title"));
  }
  if ("done" in body) {
    if (typeof body.done !== "boolean") throw new HttpError(400, "done deve ser booleano.");
    sets.push("done = ?");
    values.push(body.done ? 1 : 0);
  }
  if ("assigneeId" in body) {
    sets.push("assignee_id = ?");
    values.push(await checkAssignee(env, task.list_id, body.assigneeId));
  }
  if (!sets.length) throw new HttpError(400, "Envie ao menos um de: title, done, assigneeId.");

  await env.DB.prepare(
    `UPDATE tasks SET ${sets.join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
  ).bind(...values, task.id).run();
  return json({ task: await getTask(env, task.id) });
}

// DELETE /api/tasks/:id → 204 (subtarefas vão junto)
export async function onRequestDelete({ request, env, params }) {
  const task = await loadTask(request, env, params);
  // "OR parent_id = ?" garante as subtarefas mesmo se o banco não aplicar o ON DELETE CASCADE
  await env.DB.prepare("DELETE FROM tasks WHERE id = ? OR parent_id = ?").bind(task.id, task.id).run();
  return new Response(null, { status: 204 });
}

export { methodNotAllowed as onRequest } from "../../_lib.js";
