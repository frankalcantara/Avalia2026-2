import { json, autenticar, textoValido } from "../../../lib/util.js";

export async function onRequestPost({ request, env }) {
  const { u, erro } = await autenticar(request, env);
  if (erro) return erro;
  const corpo = await request.json().catch(() => null);
  const codigo = textoValido(corpo?.codigo, 8)?.toUpperCase();
  if (!codigo || !/^[A-HJ-NP-Z2-9]{8}$/.test(codigo))
    return json({ erro: "Código inválido." }, 400);

  const lista = await env.DB.prepare("SELECT id FROM lists WHERE code = ?").bind(codigo).first();
  if (!lista) return json({ erro: "Nenhuma lista com esse código." }, 404);

  await env.DB.prepare("INSERT OR IGNORE INTO list_members (list_id, user_id) VALUES (?, ?)")
    .bind(lista.id, u.id).run();
  return json({ id: lista.id });
}
