/**
 * /api/rooms/[code]/participants
 *   GET  -> lista de participantes (público)
 *   POST -> organizador adiciona nomes manuais (array ou texto por linha)
 */

import {
  buscarSalaPorCodigo,
  contarParticipantes,
  inserirParticipantesManuais,
  listarParticipantes,
} from "../../../_lib/db.js";
import {
  ErroHttp,
  json,
  lerJson,
  responderErro,
  verificarOrigem,
} from "../../../_lib/http.js";
import { exigirDono } from "../../../_lib/salas.js";
import { exigirSessao } from "../../../_lib/sessao.js";
import { LIMITES, normalizarCodigoSala, validarNomes } from "../../../_lib/validacao.js";

async function carregarSala(env, params) {
  const sala = await buscarSalaPorCodigo(env, normalizarCodigoSala(params.code));
  if (!sala) throw new ErroHttp(404, "sala_nao_encontrada", "Sala não encontrada.");
  return sala;
}

export async function onRequestGet({ env, params }) {
  try {
    const sala = await carregarSala(env, params);
    const participantes = await listarParticipantes(env, sala.id);
    return json({
      ok: true,
      participantes: participantes.map((pessoa) => ({
        id: pessoa.id,
        displayName: pessoa.display_name,
        source: pessoa.source,
        joinedAt: pessoa.joined_at,
      })),
    });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function onRequestPost({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await carregarSala(env, params);
    const sessao = await exigirSessao(request, env);
    exigirDono(sala, sessao);

    const existentes = await listarParticipantes(env, sala.id);
    const { nomes } = validarNomes(
      await lerJson(request),
      existentes.map((pessoa) => pessoa.display_name)
    );

    const total = existentes.length;
    if (total + nomes.length > LIMITES.participantesMax) {
      throw new ErroHttp(
        409,
        "limite_participantes",
        `A sala aceita no máximo ${LIMITES.participantesMax} participantes (já há ${total}).`
      );
    }

    await inserirParticipantesManuais(env, {
      roomId: sala.id,
      nomes,
      addedByUserId: sessao.user.userId,
    });

    const atualizados = await listarParticipantes(env, sala.id);
    return json(
      {
        ok: true,
        adicionados: nomes.length,
        total: atualizados.length,
        participantes: atualizados.map((pessoa) => ({
          id: pessoa.id,
          displayName: pessoa.display_name,
          source: pessoa.source,
          joinedAt: pessoa.joined_at,
        })),
      },
      { status: 201 }
    );
  } catch (erro) {
    return responderErro(erro);
  }
}
