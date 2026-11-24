/**
 * POST /api/reivindicacoes/:id/aceitar  — autor do item; só `pendente` com item `aberto`
 *                                          → reivindicação `aceita`, item `em_devolucao`.
 * POST /api/reivindicacoes/:id/recusar  — autor do item; só `pendente` → `recusada`.
 * POST /api/reivindicacoes/:id/cancelar — reivindicante (`pendente`/`aceita`) ou autor (`aceita`) → `cancelada`;
 *                                          se era a aceita, o item volta a `aberto`.
 * Ação desconhecida → 404. 401 / 403 / 404 / 409 conforme o contrato.
 * 200 { reivindicacao: Reivindicacao, item: Item }.
 * Toda transição é um UPDATE condicionado ao estado esperado (WHERE status = ...) conferido por meta.changes.
 */
import { ehViolacaoUnica, exigirUsuario, falha, idDaRota, json, porMetodo } from "../../../_lib/http.js";
import { buscarItem, buscarReivindicacao, serializarItem, serializarReivindicacao } from "../../../_lib/repositorio.js";

const AGORA = `atualizado_em = datetime('now')`;

async function aceitar(env, r, usuario) {
  if (r.item_autor_id !== usuario.user_id) throw falha.semPermissao("Só o autor do item pode aceitar.");
  if (r.status !== "pendente") throw falha.conflito("Só é possível aceitar uma reivindicação pendente.");
  if (r.item_status !== "aberto") throw falha.conflito("O item não está aberto.");
  const [upd] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE reivindicacoes SET status = 'aceita', ${AGORA}
        WHERE id = ? AND status = 'pendente'
          AND EXISTS (SELECT 1 FROM itens WHERE id = ? AND autor_id = ? AND status = 'aberto')`,
    ).bind(r.id, r.item_id, usuario.user_id),
    env.DB.prepare(
      `UPDATE itens SET status = 'em_devolucao', ${AGORA}
        WHERE id = ? AND status = 'aberto'
          AND EXISTS (SELECT 1 FROM reivindicacoes WHERE id = ? AND item_id = ? AND status = 'aceita')`,
    ).bind(r.item_id, r.id, r.item_id),
  ]);
  return upd.meta.changes;
}

async function recusar(env, r, usuario) {
  if (r.item_autor_id !== usuario.user_id) throw falha.semPermissao("Só o autor do item pode recusar.");
  if (r.status !== "pendente") throw falha.conflito("Só é possível recusar uma reivindicação pendente.");
  const upd = await env.DB.prepare(
    `UPDATE reivindicacoes SET status = 'recusada', ${AGORA}
      WHERE id = ? AND status = 'pendente'
        AND EXISTS (SELECT 1 FROM itens WHERE id = ? AND autor_id = ?)`,
  )
    .bind(r.id, r.item_id, usuario.user_id)
    .run();
  return upd.meta.changes;
}

async function cancelar(env, r, usuario) {
  const ehReivindicante = r.reivindicante_id === usuario.user_id;
  const ehAutor = r.item_autor_id === usuario.user_id;
  if (!ehReivindicante && !ehAutor) throw falha.semPermissao("Você não participa desta reivindicação.");
  const permitido = ehReivindicante ? ["pendente", "aceita"] : ["aceita"];
  if (!permitido.includes(r.status)) {
    throw falha.conflito(
      ehReivindicante
        ? "Só é possível cancelar uma reivindicação pendente ou aceita."
        : "O autor só pode cancelar uma reivindicação aceita (para recusar uma pendente, use recusar).",
    );
  }
  // Quem pode cancelar o quê, repetido no SQL para valer também sob concorrência.
  const quemPode = `(
      (status IN ('pendente', 'aceita') AND reivindicante_id = ?)
   OR (status = 'aceita' AND EXISTS (SELECT 1 FROM itens WHERE id = reivindicacoes.item_id AND autor_id = ?)))`;
  const [, upd] = await env.DB.batch([
    // 1) Se a reivindicação era a aceita, devolve o item para "aberto" (antes de mudar o status dela).
    env.DB.prepare(
      `UPDATE itens SET status = 'aberto', ${AGORA}
        WHERE id = ? AND status = 'em_devolucao'
          AND EXISTS (SELECT 1 FROM reivindicacoes
                       WHERE id = ? AND item_id = ? AND status = 'aceita' AND ${quemPode})`,
    ).bind(r.item_id, r.id, r.item_id, usuario.user_id, usuario.user_id),
    // 2) Cancela a reivindicação.
    env.DB.prepare(
      `UPDATE reivindicacoes SET status = 'cancelada', ${AGORA}
        WHERE id = ? AND ${quemPode}`,
    ).bind(r.id, usuario.user_id, usuario.user_id),
  ]);
  return upd.meta.changes;
}

const ACOES = { aceitar, recusar, cancelar };

async function executar(context) {
  const usuario = exigirUsuario(context);
  const { env, params } = context;
  if (!Object.hasOwn(ACOES, params.acao)) throw falha.naoEncontrado("Ação desconhecida.");
  const acao = ACOES[params.acao];
  const id = idDaRota(params.id);

  const r = await buscarReivindicacao(env, id);
  if (!r) throw falha.naoEncontrado("Reivindicação não encontrada.");
  let mudou;
  try {
    mudou = await acao(env, r, usuario);
  } catch (e) {
    // Índice único "uma aceita por item" barrou uma corrida entre dois "aceitar".
    if (ehViolacaoUnica(e)) throw falha.conflito("Outra reivindicação já foi aceita neste item.");
    throw e;
  }
  if (!mudou) throw falha.conflito("A reivindicação mudou de estado; recarregue e tente de novo.");

  const [rNova, item] = await Promise.all([buscarReivindicacao(env, id), buscarItem(env, r.item_id)]);
  return json({
    reivindicacao: serializarReivindicacao(rNova, usuario.user_id),
    item: serializarItem(item),
  });
}

export const onRequest = porMetodo({ POST: executar });
