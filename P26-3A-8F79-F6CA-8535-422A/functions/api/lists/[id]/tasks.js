import { HttpError, checkAssignee, cleanText, getTask, json, readBody, requireMember, requireUser, routeId } from "../../../_lib.js";

// POST /api/lists/:id/tasks { title, parentId?, assigneeId? } → 201 { task }
export async function onRequestPost({ request, env, params }) {
  const uid = await requireUser(request, env);
  const listId = routeId(params);
  await requireMember(env, listId, uid);

  const body = await readBody(request);
  const title = cleanText(body.title, 200, "title");
  const assigneeId = await checkAssignee(env, listId, body.assigneeId);

  let parentId = null;
  if (body.parentId !== undefined && body.parentId !== null) {
    const parent = Number.isSafeInteger(body.parentId) && body.parentId > 0 &&
      (await env.DB.prepare("SELECT 1 FROM tasks WHERE id = ? AND list_id = ? AND parent_id IS NULL")
        .bind(body.parentId, listId).first());
    if (!parent) throw new HttpError(400, "parentId precisa ser uma tarefa principal desta lista.");
    parentId = body.parentId;
  }

  const row = await env.DB.prepare(
    "INSERT INTO tasks (list_id, parent_id, title, assignee_id, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id"
  ).bind(listId, parentId, title, assigneeId, uid).first();
  return json({ task: await getTask(env, row.id) }, 201);
}

export { methodNotAllowed as onRequest } from "../../../_lib.js";
