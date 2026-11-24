/**
 * GET /api/rooms/[code]/draws
 * Histórico público de atas da sala, da mais recente para a mais antiga.
 */

import { buscarSalaPorCodigo, listarAtasDaSala } from "../../../_lib/db.js";
import { ErroHttp, json, responderErro } from "../../../_lib/http.js";
import { normalizarCodigoSala } from "../../../_lib/validacao.js";

export async function onRequestGet({ env, params }) {
  try {
    const sala = await buscarSalaPorCodigo(env, normalizarCodigoSala(params.code));
    if (!sala) throw new ErroHttp(404, "sala_nao_encontrada", "Sala não encontrada.");

    const atas = await listarAtasDaSala(env, sala.id);
    return json({
      ok: true,
      sala: { code: sala.public_code, title: sala.title },
      draws: atas.map((ata) => ({
        verificationCode: ata.verification_code,
        seq: ata.seq,
        mode: ata.mode,
        auditHash: ata.audit_hash,
        prevHash: ata.prev_hash ?? null,
        createdAt: ata.created_at,
      })),
    });
  } catch (erro) {
    return responderErro(erro);
  }
}
