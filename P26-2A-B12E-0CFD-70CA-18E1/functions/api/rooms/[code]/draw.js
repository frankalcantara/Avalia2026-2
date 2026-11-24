/**
 * POST /api/rooms/[code]/draw
 *
 * Executa o Fisher-Yates NO SERVIDOR, grava a ata imutável no D1 e devolve o
 * payload completo para o navegador conferir. Re-sorteios geram uma nova ata
 * (seq + 1) encadeada pelo `prev_hash`; nenhuma ata anterior é alterada.
 */

import {
  agoraIso,
  atualizarStatusSala,
  buscarAtaPorId,
  buscarCodigoPorHash,
  buscarSalaPorCodigo,
  codigoAtaExiste,
  gravarAta,
  hashAnterior,
  listarParticipantes,
  proximaSequencia,
} from "../../../_lib/db.js";
import { canonicalJson, codigoVerificacao, hashCanonico, novoId } from "../../../_lib/crypto.js";
import {
  ErroHttp,
  json,
  responderErro,
  verificarOrigem,
} from "../../../_lib/http.js";
import { ataPublica, exigirDono } from "../../../_lib/salas.js";
import { exigirSessao } from "../../../_lib/sessao.js";
import { montarPayloadAta, montarSorteio } from "../../../_lib/sorteio.js";
import { normalizarCodigoSala } from "../../../_lib/validacao.js";

async function gerarCodigoUnico(env) {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const codigo = codigoVerificacao();
    if (!(await codigoAtaExiste(env, codigo))) return codigo;
  }
  throw new ErroHttp(503, "codigo_indisponivel", "Não foi possível gerar o código da ata. Tente novamente.");
}

/** Converte o resultado em linhas normalizadas de draw_entries. */
function montarEntradas(result) {
  if (result.mode === "groups") {
    const entradas = [];
    let posicao = 0;
    for (const grupo of result.groups) {
      for (const membro of grupo.members) {
        posicao += 1;
        entradas.push({
          position: posicao,
          groupIndex: grupo.index,
          participantId: membro.participantId,
          userId: membro.userId ?? null,
          displayName: membro.displayName,
        });
      }
    }
    return entradas;
  }

  return result.order.map((item) => ({
    position: item.position,
    groupIndex: null,
    participantId: item.participantId,
    userId: item.userId ?? null,
    displayName: item.displayName,
  }));
}

export async function onRequestPost({ request, env, params }) {
  try {
    verificarOrigem(request);
    const sala = await buscarSalaPorCodigo(env, normalizarCodigoSala(params.code));
    if (!sala) throw new ErroHttp(404, "sala_nao_encontrada", "Sala não encontrada.");

    const sessao = await exigirSessao(request, env);
    exigirDono(sala, sessao);

    if (sala.status === "closed") {
      throw new ErroHttp(409, "sala_fechada", "Esta sala está encerrada.");
    }

    const participantes = await listarParticipantes(env, sala.id);
    if (participantes.length < 2) {
      throw new ErroHttp(
        409,
        "participantes_insuficientes",
        "São necessários pelo menos 2 participantes para realizar o sorteio."
      );
    }

    const snapshot = participantes.map((pessoa) => ({
      participantId: pessoa.id,
      userId: pessoa.user_id ?? null,
      displayName: pessoa.display_name,
      source: pessoa.source,
    }));

    let ultimaFalha = null;
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      try {
        const seq = await proximaSequencia(env, sala.id);
        const prevHash = await hashAnterior(env, sala.id);
        const drawId = novoId();
        const verificationCode = await gerarCodigoUnico(env);
        const createdAt = agoraIso();

        const { result, swaps } = montarSorteio({
          participantes: snapshot,
          mode: sala.mode,
          groupSize: sala.group_size,
        });

        const payload = montarPayloadAta({
          drawId,
          room: { id: sala.id, public_code: sala.public_code, title: sala.title },
          seq,
          participantes: snapshot,
          mode: sala.mode,
          groupSize: sala.group_size,
          swaps,
          result,
          verificationCode,
          prevHash,
          createdAt,
          createdByUserId: sessao.user.userId,
        });

        const auditHash = await hashCanonico(payload);

        await gravarAta(env, {
          ata: {
            id: drawId,
            roomId: sala.id,
            seq,
            mode: sala.mode,
            paramsJson: canonicalJson({ room: payload.room, groupSize: payload.groupSize }),
            participantsJson: canonicalJson(payload.participants),
            resultJson: canonicalJson(result),
            swapsJson: canonicalJson(swaps),
            algorithm: payload.algorithm,
            algorithmVersion: payload.algorithmVersion,
            auditHash,
            prevHash,
            verificationCode,
            createdByUserId: sessao.user.userId,
            createdAt,
          },
          entradas: montarEntradas(result),
        });

        await atualizarStatusSala(env, sala.id, "drawn");

        const linha = await buscarAtaPorId(env, drawId);
        const prevDrawCode = prevHash ? await buscarCodigoPorHash(env, prevHash) : null;
        return json(
          { ok: true, ata: ataPublica(linha, { prevDrawCode }) },
          { status: 201 }
        );
      } catch (erro) {
        // Corrida entre dois sorteios simultâneos: recalcula seq/hash e tenta de novo.
        if (/UNIQUE constraint failed/i.test(String(erro?.message ?? ""))) {
          ultimaFalha = erro;
          continue;
        }
        throw erro;
      }
    }

    console.error("[draw] concorrencia", ultimaFalha?.message);
    throw new ErroHttp(
      409,
      "concorrencia",
      "Outro sorteio foi gravado ao mesmo tempo. Tente novamente."
    );
  } catch (erro) {
    return responderErro(erro);
  }
}
