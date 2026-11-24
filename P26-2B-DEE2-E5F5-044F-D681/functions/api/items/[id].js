/**
 * PATCH /api/items/:id   { "acao": "encerrar" }
 * Só quem publicou o item pode encerrá-lo manualmente (ex.: resolveu fora da plataforma).
 * Reivindicações pendentes são recusadas e uma aceita passa a "concluida".
 */
import { json, erro, lerJson, idValido } from "../../_lib/http.js";

export async function onRequestPatch({ request, env, params, data }) {
  const id = idValido(params.id);
  if (!id) return erro(400, "id_invalido", "Item inválido.");
  const { body, erro: e } = await lerJson(request);
  if (e) return e;

  const item = await env.DB.prepare("SELECT id, owner_id, status FROM items WHERE id = ?").bind(id).first();
  if (!item) return erro(404, "nao_encontrado", "Item não encontrado.");
  if (item.owner_id !== data.user.user_id) return erro(403, "proibido", "Apenas quem publicou o item pode alterá-lo.");

  if (body.acao !== "encerrar") return erro(400, "acao_invalida", "Ação inválida.");
  if (item.status === "encerrado") return erro(409, "ja_encerrado", "Este caso já está encerrado.");

  const resultados = await env.DB.batch([
    env.DB.prepare(
      "UPDATE items SET status = 'encerrado', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status <> 'encerrado'"
    ).bind(id),
    env.DB.prepare(
      "UPDATE claims SET status = 'recusada', updated_at = datetime('now') WHERE item_id = ? AND status = 'pendente'"
    ).bind(id),
    env.DB.prepare(
      "UPDATE claims SET status = 'concluida', updated_at = datetime('now') WHERE item_id = ? AND status = 'aceita'"
    ).bind(id),
  ]);
  if (!resultados[0]?.meta?.changes) {
    return erro(409, "ja_encerrado", "Este caso já foi encerrado por outra requisição.");
  }

  return json({ ok: true, id, status: "encerrado" });
}
