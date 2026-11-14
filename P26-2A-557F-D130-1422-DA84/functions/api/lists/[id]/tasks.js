import { json, autenticar, ehMembro, idValido, textoValido } from "../../../../lib/util.js";

export async function onRequestPost({ request, env, params }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const listaId = idValido(params.id);
  if (!listaId || !(await ehMembro(env, listaId, u.id))) return json({ erro: "Lista não encontrada." }, 404);

  const b = await request.json().catch(() => null);
  const titulo = textoValido(b?.titulo, 200);
  if (!titulo) return json({ erro: "Título inválido (1 a 200 caracteres)." }, 400);

  let parentId = null;
  if (b.parent_id != null) {
    parentId = idValido(b.parent_id);
    const pai = parentId && (await env.DB.prepare("SELECT list_id, parent_id FROM tasks WHERE id = ?").bind(parentId).first());
    // o pai precisa ser da mesma lista e não pode ser, ele próprio, uma subtarefa
    if (!pai || pai.list_id !== listaId || pai.parent_id !== null)
      return json({ erro: "Tarefa-pai inválida." }, 400);
  }

  let responsavel = null;
  if (b.assignee_id != null) {
    if (typeof b.assignee_id !== "string" || !(await ehMembro(env, listaId, b.assignee_id)))
      return json({ erro: "O responsável precisa ser membro da lista." }, 400);
    responsavel = b.assignee_id;
  }

  const r = await env.DB.prepare(
    "INSERT INTO tasks (list_id, parent_id, title, assignee_id, created_by) VALUES (?, ?, ?, ?, ?)"
  ).bind(listaId, parentId, titulo, responsavel, u.id).run();
  return json({ id: r.meta.last_row_id }, 201);
}
