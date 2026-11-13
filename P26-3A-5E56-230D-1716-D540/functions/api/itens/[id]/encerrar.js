/**
 * POST /api/itens/:id/encerrar — autor, ou reivindicante com reivindicação `aceita`.
 *  - item em_devolucao → encerrado; reivindicação aceita → concluida; demais pendentes → recusada (atômico).
 *  - item aberto → só o autor, e só se o item não tem reivindicação pendente/aceita (resolveu por fora);
 *    com pendentes → 409 (recuse-as antes). Decisão restritiva para "sem reivindicação" do contrato.
 *  - item encerrado → 409.
 * 200 { item: Item }.
 */
import { exigirUsuario, falha, idDaRota, json, porMetodo } from "../../../_lib/http.js";
import { buscarItem, serializarItem } from "../../../_lib/repositorio.js";

async function encerrar(context) {
  const usuario = exigirUsuario(context);
  const { env, params } = context;
  const id = idDaRota(params.id);
  const linha = await buscarItem(env, id);
  if (!linha) throw falha.naoEncontrado("Item não encontrado.");

  const ehAutor = linha.autor_id === usuario.user_id;
  if (!ehAutor) {
    // "concluida" também conta: quem já encerrou e tenta de novo recebe 409 (já encerrado), não 403.
    const parte = await env.DB.prepare(
      `SELECT 1 AS x FROM reivindicacoes
        WHERE item_id = ? AND reivindicante_id = ? AND status IN ('aceita', 'concluida')`,
    )
      .bind(id, usuario.user_id)
      .first();
    if (!parte) throw falha.semPermissao("Só o autor ou o reivindicante aceito pode encerrar o item.");
  }
  if (linha.status === "encerrado") throw falha.conflito("O item já está encerrado.");

  if (linha.status === "em_devolucao") {
    const itemEncerrado = `EXISTS (SELECT 1 FROM itens WHERE id = ? AND status = 'encerrado')`;
    const [r] = await env.DB.batch([
      env.DB.prepare(
        `UPDATE itens
            SET status = 'encerrado', encerrado_em = datetime('now'), atualizado_em = datetime('now')
          WHERE id = ? AND status = 'em_devolucao'
            AND (autor_id = ? OR EXISTS (SELECT 1 FROM reivindicacoes
                                          WHERE item_id = ? AND reivindicante_id = ? AND status = 'aceita'))`,
      ).bind(id, usuario.user_id, id, usuario.user_id),
      env.DB.prepare(
        `UPDATE reivindicacoes SET status = 'concluida', atualizado_em = datetime('now')
          WHERE item_id = ? AND status = 'aceita' AND ${itemEncerrado}`,
      ).bind(id, id),
      env.DB.prepare(
        `UPDATE reivindicacoes SET status = 'recusada', atualizado_em = datetime('now')
          WHERE item_id = ? AND status = 'pendente' AND ${itemEncerrado}`,
      ).bind(id, id),
    ]);
    if (!r.meta.changes) throw falha.conflito("O item mudou de estado; recarregue e tente de novo.");
  } else {
    // aberto: só o autor (o reivindicante não tem aceita com item aberto, então já recebeu 403 acima).
    const r = await env.DB.prepare(
      `UPDATE itens
          SET status = 'encerrado', encerrado_em = datetime('now'), atualizado_em = datetime('now')
        WHERE id = ? AND autor_id = ? AND status = 'aberto'
          AND NOT EXISTS (SELECT 1 FROM reivindicacoes WHERE item_id = ? AND status IN ('pendente', 'aceita'))`,
    )
      .bind(id, usuario.user_id, id)
      .run();
    if (!r.meta.changes) {
      throw falha.conflito("O item tem reivindicações pendentes: aceite ou recuse antes de encerrar.");
    }
  }

  return json({ item: serializarItem(await buscarItem(env, id)) });
}

export const onRequest = porMetodo({ POST: encerrar });
