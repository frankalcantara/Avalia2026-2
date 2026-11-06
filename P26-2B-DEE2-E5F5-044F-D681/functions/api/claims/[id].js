/**
 * PATCH /api/claims/:id   { "acao": "aceitar" | "recusar" | "cancelar" | "concluir" }
 *
 * Máquina de estados (validada no servidor):
 *   pendente --aceitar (dono)-------------> aceita     (item: aberto -> em_devolucao)
 *   pendente --recusar (dono)-------------> recusada
 *   pendente/aceita --cancelar (reivind.)-> cancelada  (se estava aceita, item volta a aberto)
 *   aceita --concluir (qualquer parte)----> concluida  (item -> encerrado; pendentes -> recusada)
 */
import { json, erro, lerJson, idValido } from "../../_lib/http.js";

const REGRAS = {
  aceitar: { quem: "dono", de: ["pendente"] },
  recusar: { quem: "dono", de: ["pendente"] },
  cancelar: { quem: "reivindicante", de: ["pendente", "aceita"] },
  concluir: { quem: "qualquer", de: ["aceita"] },
};

export async function onRequestPatch({ request, env, params, data }) {
  const id = idValido(params.id);
  if (!id) return erro(400, "id_invalido", "Reivindicação inválida.");
  const { body, erro: e } = await lerJson(request);
  if (e) return e;

  const acao = body.acao;
  // Object.hasOwn: impede que "constructor", "toString" etc. sejam tratados como ação (dava 500)
  const regra = typeof acao === "string" && Object.hasOwn(REGRAS, acao) ? REGRAS[acao] : null;
  if (!regra) return erro(400, "acao_invalida", "Ação inválida.");

  const c = await env.DB.prepare(
    `SELECT c.id, c.item_id, c.owner_id, c.claimant_id, c.status, i.status AS item_status
       FROM claims c JOIN items i ON i.id = c.item_id WHERE c.id = ?`
  ).bind(id).first();
  if (!c) return erro(404, "nao_encontrado", "Reivindicação não encontrada.");

  const me = data.user.user_id;
  const souDono = c.owner_id === me;
  const souReivindicante = c.claimant_id === me;
  if (!souDono && !souReivindicante) return erro(403, "proibido", "Você não participa desta reivindicação.");
  if (regra.quem === "dono" && !souDono) return erro(403, "proibido", "Só quem publicou o item pode fazer isso.");
  if (regra.quem === "reivindicante" && !souReivindicante) return erro(403, "proibido", "Só quem abriu a reivindicação pode cancelá-la.");
  if (!regra.de.includes(c.status)) {
    return erro(409, "transicao_invalida", `Não é possível "${acao}" uma reivindicação com status "${c.status}".`);
  }

  const agora = "datetime('now')";
  let stmts = [];

  if (acao === "aceitar") {
    if (c.item_status !== "aberto") return erro(409, "item_indisponivel", "O item já está em devolução ou encerrado.");
    // updates condicionais: só aplicam se o estado ainda for o esperado (evita condição de corrida)
    stmts = [
      env.DB.prepare(
        `UPDATE claims SET status = 'aceita', updated_at = ${agora}
          WHERE id = ? AND status = 'pendente'
            AND EXISTS (SELECT 1 FROM items WHERE id = ? AND status = 'aberto')`
      ).bind(id, c.item_id),
      env.DB.prepare(
        `UPDATE items SET status = 'em_devolucao', updated_at = ${agora}
          WHERE id = ? AND status = 'aberto'
            AND EXISTS (SELECT 1 FROM claims WHERE id = ? AND status = 'aceita')`
      ).bind(c.item_id, id),
    ];
  } else if (acao === "recusar") {
    stmts = [
      env.DB.prepare(`UPDATE claims SET status = 'recusada', updated_at = ${agora} WHERE id = ? AND status = 'pendente'`).bind(id),
    ];
  } else if (acao === "cancelar") {
    stmts = [
      env.DB.prepare(
        `UPDATE claims SET status = 'cancelada', updated_at = ${agora} WHERE id = ? AND status IN ('pendente','aceita')`
      ).bind(id),
    ];
    if (c.status === "aceita") {
      stmts.push(
        env.DB.prepare(
          `UPDATE items SET status = 'aberto', updated_at = ${agora}
            WHERE id = ? AND status = 'em_devolucao'
              AND NOT EXISTS (SELECT 1 FROM claims WHERE item_id = ? AND status = 'aceita')`
        ).bind(c.item_id, c.item_id)
      );
    }
  } else if (acao === "concluir") {
    stmts = [
      env.DB.prepare(`UPDATE claims SET status = 'concluida', updated_at = ${agora} WHERE id = ? AND status = 'aceita'`).bind(id),
      env.DB.prepare(
        `UPDATE items SET status = 'encerrado', closed_at = ${agora}, updated_at = ${agora}
          WHERE id = ? AND status <> 'encerrado'
            AND EXISTS (SELECT 1 FROM claims WHERE id = ? AND status = 'concluida')`
      ).bind(c.item_id, id),
      env.DB.prepare(
        `UPDATE claims SET status = 'recusada', updated_at = ${agora} WHERE item_id = ? AND status = 'pendente'`
      ).bind(c.item_id),
    ];
  }

  const resultados = await env.DB.batch(stmts);
  if (!resultados[0]?.meta?.changes) {
    return erro(409, "conflito", "A reivindicação mudou de estado enquanto você agia. Atualize a página.");
  }

  const novo = await env.DB.prepare(
    "SELECT c.status, i.status AS item_status FROM claims c JOIN items i ON i.id = c.item_id WHERE c.id = ?"
  ).bind(id).first();

  return json({ ok: true, id, status: novo.status, item_status: novo.item_status });
}
