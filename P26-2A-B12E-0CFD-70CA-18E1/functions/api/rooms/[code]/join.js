/**
 * /api/rooms/[code]/join
 *   POST   -> aluno autenticado entra na sala com o próprio perfil do Discord
 *   DELETE -> aluno sai da sala (remove apenas a própria entrada)
 */

import {
  adicionarParticipanteDiscord,
  buscarParticipanteDoUsuario,
  buscarSalaPorCodigo,
  contarParticipantes,
  removerParticipanteDoUsuario,
} from "../../../_lib/db.js";
import {
  ErroHttp,
  json,
  responderErro,
  verificarOrigem,
} from "../../../_lib/http.js";
import { exigirSessao } from "../../../_lib/sessao.js";
import { LIMITES, normalizarCodigoSala, normalizarNome } from "../../../_lib/validacao.js";

async function carregarSala(env, params) {
  const sala = await buscarSalaPorCodigo(env, normalizarCodigoSala(params.code));
  if (!sala) throw new ErroHttp(404, "sala_nao_encontrada", "Sala não encontrada.");
  return sala;
}

function nomeDoAluno(usuario) {
  const candidato = normalizarNome(usuario.globalName || usuario.username).slice(0, LIMITES.nomeMax);
  if (candidato.length >= LIMITES.nomeMin) return candidato;
  const reserva = normalizarNome(usuario.username).slice(0, LIMITES.nomeMax);
  if (reserva.length >= LIMITES.nomeMin) return reserva;
  throw new ErroHttp(400, "nome_invalido", "Seu nome do Discord é curto demais para entrar na sala.");
}

export async function onRequestPost({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await carregarSala(env, params);
    const sessao = await exigirSessao(request, env);

    if (!sala.allow_join) {
      throw new ErroHttp(403, "entrada_fechada", "O organizador fechou a entrada nesta sala.");
    }
    if (sala.status === "closed") {
      throw new ErroHttp(403, "sala_fechada", "Esta sala está encerrada.");
    }

    const existente = await buscarParticipanteDoUsuario(env, sala.id, sessao.user.userId);
    if (existente) {
      return json({
        ok: true,
        jaParticipava: true,
        participante: {
          id: existente.id,
          displayName: existente.display_name,
          source: "discord",
          joinedAt: existente.joined_at,
        },
      });
    }

    const total = await contarParticipantes(env, sala.id);
    if (total >= LIMITES.participantesMax) {
      throw new ErroHttp(
        409,
        "sala_cheia",
        `A sala já atingiu o limite de ${LIMITES.participantesMax} participantes.`
      );
    }

    const displayName = nomeDoAluno(sessao.user);
    const inserido = await adicionarParticipanteDiscord(env, {
      roomId: sala.id,
      userId: sessao.user.userId,
      displayName,
      addedByUserId: sessao.user.userId,
    });

    const participante = await buscarParticipanteDoUsuario(env, sala.id, sessao.user.userId);
    if (!participante) {
      throw new ErroHttp(409, "entrada_concorrente", "Não foi possível confirmar sua entrada. Tente novamente.");
    }

    return json(
      {
        ok: true,
        jaParticipava: !inserido,
        participante: {
          id: participante.id,
          displayName: participante.display_name,
          source: "discord",
          joinedAt: participante.joined_at,
        },
      },
      { status: inserido ? 201 : 200 }
    );
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await carregarSala(env, params);
    const sessao = await exigirSessao(request, env);

    const removido = await removerParticipanteDoUsuario(env, sala.id, sessao.user.userId);
    if (!removido) {
      throw new ErroHttp(404, "nao_participa", "Você não está inscrito nesta sala.");
    }
    return json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
