/**
 * DELETE /api/rooms/[code]/participants/[id]
 * Remove um participante. Manual: só o organizador. Discord: o próprio aluno
 * também pode sair pelo endpoint /join (DELETE).
 */

import { buscarSalaPorCodigo, removerParticipante } from "../../../../_lib/db.js";
import {
  ErroHttp,
  json,
  responderErro,
  verificarOrigem,
} from "../../../../_lib/http.js";
import { exigirDono } from "../../../../_lib/salas.js";
import { exigirSessao } from "../../../../_lib/sessao.js";
import { normalizarCodigoSala } from "../../../../_lib/validacao.js";

export async function onRequestDelete({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await buscarSalaPorCodigo(env, normalizarCodigoSala(params.code));
    if (!sala) throw new ErroHttp(404, "sala_nao_encontrada", "Sala não encontrada.");

    const sessao = await exigirSessao(request, env);
    exigirDono(sala, sessao);

    const participantId = Number(params.id);
    if (!Number.isInteger(participantId) || participantId <= 0) {
      throw new ErroHttp(400, "id_invalido", "Identificador de participante inválido.");
    }

    const removido = await removerParticipante(env, sala.id, participantId);
    if (!removido) throw new ErroHttp(404, "participante_nao_encontrado", "Participante não encontrado.");

    return json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
