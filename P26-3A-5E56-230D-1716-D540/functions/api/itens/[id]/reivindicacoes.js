/**
 * POST /api/itens/:id/reivindicacoes — logado e não autor. Corpo { mensagem } (10–500 chars).
 * Ordem das checagens: 401 → 415/400 (JSON) → 404 item → 403 próprio item → 400 mensagem →
 * 409 item não aberto → 409 já tem reivindicação ativa → 429 se já fez 5 reivindicações (qualquer status) no item.
 * Grava contato_autor = username do autor e contato_reivindicante = username do reivindicante.
 * 201 { reivindicacao: Reivindicacao }.
 */
import { ehViolacaoUnica, exigirUsuario, falha, idDaRota, json, lerJson, porMetodo } from "../../../_lib/http.js";
import { validarReivindicacao } from "../../../_lib/validacao.js";
import { buscarItem, buscarReivindicacao, serializarReivindicacao } from "../../../_lib/repositorio.js";

// Auditoria de segurança (docs/AUDITORIA-SEGURANCA.md, achado M1): sem teto, criar+cancelar em laço gerava
// linhas sem limite no item da vítima. Conta reivindicações de qualquer status do usuário naquele item.
const LIMITE_POR_ITEM = 5;

async function criar(context) {
  const usuario = exigirUsuario(context);
  const { env, params, request } = context;
  const id = idDaRota(params.id);
  const corpo = await lerJson(request);

  const item = await buscarItem(env, id);
  if (!item) throw falha.naoEncontrado("Item não encontrado.");
  if (item.autor_id === usuario.user_id) throw falha.semPermissao("Você não pode reivindicar o próprio item.");
  const v = validarReivindicacao(corpo);
  if (!v.ok) throw falha.invalido("Mensagem inválida.", v.erros);
  if (item.status !== "aberto") throw falha.conflito("Este item não está aberto para reivindicações.");

  let novo;
  try {
    // Insere só se o item continua aberto, não é do usuário e o usuário ainda não atingiu o limite de
    // reivindicações neste item (condições e escrita na mesma instrução, sem corrida).
    novo = await env.DB.prepare(
      `INSERT INTO reivindicacoes (item_id, reivindicante_id, mensagem, status, contato_autor, contato_reivindicante)
       SELECT i.id, ur.user_id, ?, 'pendente', ua.username, ur.username
         FROM itens i
         JOIN usuarios ua ON ua.user_id = i.autor_id
         JOIN usuarios ur ON ur.user_id = ?
        WHERE i.id = ? AND i.status = 'aberto' AND i.autor_id <> ?
          AND (SELECT COUNT(*) FROM reivindicacoes WHERE item_id = i.id AND reivindicante_id = ur.user_id) < ?
       RETURNING id`,
    )
      .bind(v.valor.mensagem, usuario.user_id, id, usuario.user_id, LIMITE_POR_ITEM)
      .first();
  } catch (e) {
    if (ehViolacaoUnica(e)) throw falha.conflito("Você já tem uma reivindicação ativa neste item.");
    throw e;
  }
  if (!novo) {
    const feitas = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM reivindicacoes WHERE item_id = ? AND reivindicante_id = ?`,
    )
      .bind(id, usuario.user_id)
      .first();
    if (Number(feitas && feitas.n) >= LIMITE_POR_ITEM) {
      throw falha.limite(`Limite de ${LIMITE_POR_ITEM} reivindicações por item atingido.`);
    }
    throw falha.conflito("Este item não está mais aberto para reivindicações.");
  }

  const linha = await buscarReivindicacao(env, novo.id);
  return json({ reivindicacao: serializarReivindicacao(linha, usuario.user_id) }, 201);
}

export const onRequest = porMetodo({ POST: criar });
