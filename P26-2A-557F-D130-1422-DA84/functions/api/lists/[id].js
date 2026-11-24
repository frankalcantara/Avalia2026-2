import { json, autenticar, ehMembro, idValido } from "../../../lib/util.js";

export async function onRequestGet({ request, env, params }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const id = idValido(params.id);
  // 404 (e não 403) para não revelar que a lista existe a quem não é membro
  if (!id || !(await ehMembro(env, id, u.id))) return json({ erro: "Lista não encontrada." }, 404);

  const lista = await env.DB.prepare("SELECT id, name, code, owner_id FROM lists WHERE id = ?").bind(id).first();
  const membros = (await env.DB.prepare(
    `SELECT u.user_id AS id, u.username, u.avatar AS avatar_url FROM list_members m
     JOIN discord_users u ON u.user_id = m.user_id WHERE m.list_id = ? ORDER BY m.joined_at`
  ).bind(id).all()).results;
  const tarefas = (await env.DB.prepare(
    "SELECT id, parent_id, title, done, assignee_id FROM tasks WHERE list_id = ? ORDER BY id"
  ).bind(id).all()).results;
  return json({ lista, membros, tarefas });
}

export async function onRequestDelete({ request, env, params }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const id = idValido(params.id);
  const lista = id && (await env.DB.prepare("SELECT owner_id FROM lists WHERE id = ?").bind(id).first());
  if (!lista || !(await ehMembro(env, id, u.id))) return json({ erro: "Lista não encontrada." }, 404);
  if (lista.owner_id !== u.id) return json({ erro: "Só o dono pode excluir a lista." }, 403);

  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET parent_id = NULL WHERE list_id = ?").bind(id),
    env.DB.prepare("DELETE FROM tasks WHERE list_id = ?").bind(id),
    env.DB.prepare("DELETE FROM list_members WHERE list_id = ?").bind(id),
    env.DB.prepare("DELETE FROM lists WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}
