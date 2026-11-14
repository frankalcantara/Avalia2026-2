import { json, autenticar, ehMembro, idValido, textoValido } from "../../../lib/util.js";

async function carregar(env, params, u) {
  const id = idValido(params.id);
  const t = id && (await env.DB.prepare("SELECT id, list_id, created_by FROM tasks WHERE id = ?").bind(id).first());
  if (!t || !(await ehMembro(env, t.list_id, u.id))) return null;
  return t;
}

export async function onRequestPatch({ request, env, params }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const t = await carregar(env, params, u);
  if (!t) return json({ erro: "Tarefa não encontrada." }, 404);

  const b = await request.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ erro: "Corpo inválido." }, 400);
  const sets = [], vals = [];

  if ("done" in b) {
    if (typeof b.done !== "boolean") return json({ erro: "Estado de conclusão inválido." }, 400);
    sets.push("done = ?"); vals.push(b.done ? 1 : 0);
  }
  if ("title" in b) {
    const titulo = textoValido(b.title, 200);
    if (!titulo) return json({ erro: "Título inválido." }, 400);
    sets.push("title = ?"); vals.push(titulo);
  }
  if ("assignee_id" in b) {
    if (b.assignee_id !== null &&
        (typeof b.assignee_id !== "string" || !(await ehMembro(env, t.list_id, b.assignee_id))))
      return json({ erro: "O responsável precisa ser membro da lista." }, 400);
    sets.push("assignee_id = ?"); vals.push(b.assignee_id);
  }
  if (!sets.length) return json({ erro: "Nada para atualizar." }, 400);

  await env.DB.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, t.id).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const t = await carregar(env, params, u);
  if (!t) return json({ erro: "Tarefa não encontrada." }, 404);
  const lista = await env.DB.prepare("SELECT owner_id FROM lists WHERE id = ?").bind(t.list_id).first();
  if (u.id !== t.created_by && u.id !== lista?.owner_id)
    return json({ erro: "Só o autor da tarefa ou o dono da lista pode excluí-la." }, 403);
  await env.DB.prepare("DELETE FROM tasks WHERE id = ? OR parent_id = ?").bind(t.id, t.id).run();
  return json({ ok: true });
}
