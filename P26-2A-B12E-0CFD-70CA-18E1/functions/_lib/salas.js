/**
 * Serialização de salas e atas para a API pública.
 *
 * Regra de ouro: a ata devolvida pela API precisa reconstruir EXATAMENTE o
 * payload que foi hasheado na gravação. Por isso a sala (id, código e título)
 * vem do snapshot `params_json`, e não da tabela `rooms` (que pode ser editada).
 */

import { ErroHttp } from "./http.js";

/** Garante que quem chama é o dono da sala. */
export function exigirDono(sala, sessao) {
  if (sala.owner_user_id !== sessao.user.userId) {
    throw new ErroHttp(403, "sem_permissao", "Apenas o organizador da sala pode fazer isso.");
  }
}

/** Resumo de sala para a lista "Minhas salas". */
export function resumoSala(linha) {
  return {
    code: linha.public_code,
    title: linha.title,
    mode: linha.mode,
    groupSize: linha.group_size,
    allowJoin: Boolean(linha.allow_join),
    status: linha.status,
    createdAt: linha.created_at,
    updatedAt: linha.updated_at,
    participantsCount: Number(linha.participants_count ?? 0),
    drawsCount: Number(linha.draws_count ?? 0),
  };
}

/** Detalhe público da sala (sem expor user_id de quem entrou). */
export function detalheSala(
  sala,
  { participantes = [], atas = [], isOwner = false, isParticipant = false, ownerName = null }
) {
  return {
    code: sala.public_code,
    title: sala.title,
    mode: sala.mode,
    groupSize: sala.group_size,
    allowJoin: Boolean(sala.allow_join),
    status: sala.status,
    createdAt: sala.created_at,
    updatedAt: sala.updated_at,
    ownerName,
    isOwner,
    isParticipant,
    participants: participantes.map((pessoa) => ({
      id: pessoa.id,
      displayName: pessoa.display_name,
      source: pessoa.source,
      joinedAt: pessoa.joined_at,
    })),
    draws: atas.map((ata) => ({
      verificationCode: ata.verification_code,
      seq: ata.seq,
      mode: ata.mode,
      auditHash: ata.audit_hash,
      prevHash: ata.prev_hash ?? null,
      createdAt: ata.created_at,
    })),
  };
}

function jsonSeguro(texto, padrao) {
  try {
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
}

/**
 * Reconstrói o payload canônico da ata a partir da linha do D1.
 * É o mesmo objeto que passou por `canonicalJson` + SHA-256 na gravação.
 */
export function payloadDaAta(linha) {
  const params = jsonSeguro(linha.params_json, {});
  return {
    algorithm: linha.algorithm,
    algorithmVersion: linha.algorithm_version,
    drawId: linha.id,
    room: params.room,
    seq: linha.seq,
    mode: linha.mode,
    groupSize: params.groupSize ?? null,
    participants: jsonSeguro(linha.participants_json, []),
    swaps: jsonSeguro(linha.swaps_json, []),
    result: jsonSeguro(linha.result_json, {}),
    verificationCode: linha.verification_code,
    prevHash: linha.prev_hash ?? null,
    createdAt: linha.created_at,
    createdByUserId: linha.created_by_user_id,
  };
}

/** Ata pública: payload + hash + entradas normalizadas + elo anterior. */
export function ataPublica(linha, { prevDrawCode = null } = {}) {
  const payload = payloadDaAta(linha);
  return {
    ...payload,
    auditHash: linha.audit_hash,
    prevDrawCode,
    entries: (linha.entries ?? []).map((entrada) => ({
      position: entrada.position,
      groupIndex: entrada.group_index,
      participantId: entrada.participant_id,
      userId: entrada.user_id,
      displayName: entrada.display_name,
    })),
    verificationUrl: `/api/draws/${encodeURIComponent(linha.verification_code)}`,
  };
}
