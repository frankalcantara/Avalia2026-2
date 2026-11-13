/**
 * Consultas e serialização compartilhadas (itens e reivindicações).
 * Todo SQL usa prepare().bind(); nenhum valor do usuário é concatenado.
 *
 * Item = { id, tipo, categoria, titulo, descricao, local, data_ocorrencia, status, criado_em,
 *          encerrado_em, autor: { user_id, username, nome_exibicao, avatar_url }, total_reivindicacoes }
 *   total_reivindicacoes conta as reivindicações do item que NÃO estão "cancelada".
 *
 * Reivindicacao = { id, item_id, status, mensagem, criado_em, atualizado_em,
 *                   reivindicante: { user_id, username, nome_exibicao, avatar_url },
 *                   item: { id, titulo, tipo, categoria, status, autor_id,
 *                           autor: { user_id, username, nome_exibicao, avatar_url } },
 *                   contato_autor?, contato_reivindicante? }
 *   Os contatos só são incluídos quando quem pede é o autor do item ou o reivindicante
 *   (serializarReivindicacao é o único ponto que monta esse objeto).
 */

export const SELECT_ITEM = `
  SELECT i.id, i.autor_id, i.tipo, i.categoria, i.titulo, i.descricao, i.local, i.data_ocorrencia,
         i.status, i.criado_em, i.encerrado_em,
         u.username AS autor_username, u.nome_exibicao AS autor_nome_exibicao, u.avatar_url AS autor_avatar_url,
         (SELECT COUNT(*) FROM reivindicacoes r WHERE r.item_id = i.id AND r.status <> 'cancelada') AS total_reivindicacoes
    FROM itens i
    JOIN usuarios u ON u.user_id = i.autor_id`;

export function serializarItem(l) {
  return {
    id: l.id,
    tipo: l.tipo,
    categoria: l.categoria,
    titulo: l.titulo,
    descricao: l.descricao,
    local: l.local,
    data_ocorrencia: l.data_ocorrencia,
    status: l.status,
    criado_em: l.criado_em,
    encerrado_em: l.encerrado_em,
    autor: {
      user_id: l.autor_id,
      username: l.autor_username,
      nome_exibicao: l.autor_nome_exibicao,
      avatar_url: l.autor_avatar_url,
    },
    total_reivindicacoes: Number(l.total_reivindicacoes || 0),
  };
}

/** Linha crua do item (inclui autor_id) ou null. */
export async function buscarItem(env, id) {
  return (await env.DB.prepare(`${SELECT_ITEM} WHERE i.id = ?`).bind(id).first()) || null;
}

export const SELECT_REIVINDICACAO = `
  SELECT r.id, r.item_id, r.reivindicante_id, r.mensagem, r.status, r.contato_autor, r.contato_reivindicante,
         r.criado_em, r.atualizado_em,
         ur.username AS reiv_username, ur.nome_exibicao AS reiv_nome_exibicao, ur.avatar_url AS reiv_avatar_url,
         i.titulo AS item_titulo, i.tipo AS item_tipo, i.categoria AS item_categoria, i.status AS item_status,
         i.autor_id AS item_autor_id,
         ua.username AS autor_username, ua.nome_exibicao AS autor_nome_exibicao, ua.avatar_url AS autor_avatar_url
    FROM reivindicacoes r
    JOIN usuarios ur ON ur.user_id = r.reivindicante_id
    JOIN itens i ON i.id = r.item_id
    JOIN usuarios ua ON ua.user_id = i.autor_id`;

export function serializarReivindicacao(l, usuarioId) {
  const r = {
    id: l.id,
    item_id: l.item_id,
    status: l.status,
    mensagem: l.mensagem,
    criado_em: l.criado_em,
    atualizado_em: l.atualizado_em,
    reivindicante: {
      user_id: l.reivindicante_id,
      username: l.reiv_username,
      nome_exibicao: l.reiv_nome_exibicao,
      avatar_url: l.reiv_avatar_url,
    },
    item: {
      id: l.item_id,
      titulo: l.item_titulo,
      tipo: l.item_tipo,
      categoria: l.item_categoria,
      status: l.item_status,
      autor_id: l.item_autor_id,
      // Mesmos 4 campos públicos de Item.autor (já expostos em GET /api/itens); nada além.
      autor: {
        user_id: l.item_autor_id,
        username: l.autor_username,
        nome_exibicao: l.autor_nome_exibicao,
        avatar_url: l.autor_avatar_url,
      },
    },
  };
  if (usuarioId && (usuarioId === l.reivindicante_id || usuarioId === l.item_autor_id)) {
    r.contato_autor = l.contato_autor;
    r.contato_reivindicante = l.contato_reivindicante;
  }
  return r;
}

/** Linha crua da reivindicação (inclui item_autor_id, reivindicante_id, item_status) ou null. */
export async function buscarReivindicacao(env, id) {
  return (await env.DB.prepare(`${SELECT_REIVINDICACAO} WHERE r.id = ?`).bind(id).first()) || null;
}
