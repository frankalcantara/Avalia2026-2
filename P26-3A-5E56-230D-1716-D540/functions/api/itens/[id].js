/**
 * GET    /api/itens/:id (público)
 *   200 { item: Item, reivindicacoes: [Reivindicacao], permissoes: { eh_autor, pode_reivindicar, pode_encerrar, pode_apagar } }
 *   reivindicacoes: autor → todas as recebidas no item; usuário logado não autor → só as dele; demais → [].
 * DELETE /api/itens/:id (autor) — só se `aberto` e sem reivindicação `aceita`. 200 { ok: true }.
 * id não numérico → 400; inexistente → 404; não autor → 403; estado → 409.
 */
import { exigirUsuario, falha, idDaRota, json, porMetodo } from "../../_lib/http.js";
import {
  SELECT_REIVINDICACAO,
  buscarItem,
  serializarItem,
  serializarReivindicacao,
} from "../../_lib/repositorio.js";

async function detalhe({ env, params, data }) {
  const id = idDaRota(params.id);
  const linha = await buscarItem(env, id);
  if (!linha) throw falha.naoEncontrado("Item não encontrado.");
  const usuario = data.usuario;
  const ehAutor = Boolean(usuario && usuario.user_id === linha.autor_id);

  let reivindicacoes = [];
  if (usuario) {
    const sql = ehAutor
      ? `${SELECT_REIVINDICACAO} WHERE r.item_id = ? ORDER BY r.criado_em DESC, r.id DESC`
      : `${SELECT_REIVINDICACAO} WHERE r.item_id = ? AND r.reivindicante_id = ? ORDER BY r.criado_em DESC, r.id DESC`;
    const stmt = ehAutor ? env.DB.prepare(sql).bind(id) : env.DB.prepare(sql).bind(id, usuario.user_id);
    const { results } = await stmt.all();
    reivindicacoes = results.map((r) => serializarReivindicacao(r, usuario.user_id));
  }

  const ativaMinha = !ehAutor && reivindicacoes.some((r) => r.status === "pendente" || r.status === "aceita");
  const aceitaMinha = !ehAutor && reivindicacoes.some((r) => r.status === "aceita");
  const temPendente = ehAutor && reivindicacoes.some((r) => r.status === "pendente");
  const permissoes = {
    eh_autor: ehAutor,
    pode_reivindicar: Boolean(usuario) && !ehAutor && linha.status === "aberto" && !ativaMinha,
    pode_encerrar:
      (ehAutor && (linha.status === "em_devolucao" || (linha.status === "aberto" && !temPendente))) ||
      (aceitaMinha && linha.status === "em_devolucao"),
    pode_apagar: ehAutor && linha.status === "aberto",
  };

  return json({ item: serializarItem(linha), reivindicacoes, permissoes });
}

async function apagar(context) {
  const usuario = exigirUsuario(context);
  const { env, params } = context;
  const id = idDaRota(params.id);
  const linha = await buscarItem(env, id);
  if (!linha) throw falha.naoEncontrado("Item não encontrado.");
  if (linha.autor_id !== usuario.user_id) throw falha.semPermissao("Só o autor pode apagar o item.");
  if (linha.status !== "aberto") throw falha.conflito("Só é possível apagar um item com status aberto.");

  const r = await env.DB.prepare(
    `DELETE FROM itens
      WHERE id = ? AND autor_id = ? AND status = 'aberto'
        AND NOT EXISTS (SELECT 1 FROM reivindicacoes WHERE item_id = ? AND status = 'aceita')`,
  )
    .bind(id, usuario.user_id, id)
    .run();
  if (!r.meta.changes) throw falha.conflito("O item mudou de estado e não pode mais ser apagado.");
  return json({ ok: true });
}

export const onRequest = porMetodo({ GET: detalhe, DELETE: apagar });
