/**
 * Núcleo do sorteio auditável.
 *
 * Regras do projeto:
 *   - Fisher-Yates executa SEMPRE no servidor (Cloudflare Function).
 *   - Cada troca de posição é registrada em `swaps`, o que permite reexecutar
 *     o algoritmo no navegador do aluno e provar que o resultado não mudou.
 *   - O resultado e a trilha entram no hash canônico da ata.
 *
 * Módulo puro: recebe o gerador aleatório por parâmetro para poder ser testado.
 */

import { randomInt } from "./crypto.js";

/**
 * Fisher-Yates com viés zero (o gerador já faz rejeição de módulo).
 * @param {Array} itens
 * @param {(max: number) => number} rng
 * @returns {{ result: Array, swaps: Array<[number, number]> }}
 */
export function fisherYates(itens, rng = randomInt) {
  const result = itens.slice();
  const swaps = [];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = rng(i + 1);
    if (j !== i) {
      const troca = result[i];
      result[i] = result[j];
      result[j] = troca;
      swaps.push([i, j]);
    }
  }
  return { result, swaps };
}

/**
 * Distribui uma lista já embaralhada em grupos com tamanho máximo.
 * Os grupos ficam balanceados: a diferença entre o maior e o menor é no máximo 1.
 */
export function distribuirGrupos(itens, tamanhoMaximo) {
  if (itens.length === 0) return [];
  const quantidadeGrupos = Math.ceil(itens.length / tamanhoMaximo);
  const base = Math.floor(itens.length / quantidadeGrupos);
  const resto = itens.length % quantidadeGrupos;

  const grupos = [];
  let cursor = 0;
  for (let g = 0; g < quantidadeGrupos; g += 1) {
    const tamanho = base + (g < resto ? 1 : 0);
    grupos.push(itens.slice(cursor, cursor + tamanho));
    cursor += tamanho;
  }
  return grupos;
}

/**
 * Executa o sorteio e devolve a trilha + resultado no formato da ata.
 * @param {{
 *   participantes: Array<{ participantId: number, userId: string|null, displayName: string, source: string }>,
 *   mode: "groups"|"order",
 *   groupSize: number|null,
 *   rng?: (max: number) => number
 * }} entrada
 */
export function montarSorteio({ participantes, mode, groupSize, rng = randomInt }) {
  const { result: embaralhados, swaps } = fisherYates(participantes, rng);

  if (mode === "order") {
    return {
      swaps,
      result: {
        mode: "order",
        order: embaralhados.map((pessoa, indice) => ({
          position: indice + 1,
          participantId: pessoa.participantId,
          userId: pessoa.userId,
          displayName: pessoa.displayName,
        })),
      },
    };
  }

  return {
    swaps,
    result: {
      mode: "groups",
      groups: distribuirGrupos(embaralhados, groupSize).map((membros, indice) => ({
        index: indice + 1,
        members: membros.map((pessoa) => ({
          participantId: pessoa.participantId,
          userId: pessoa.userId,
          displayName: pessoa.displayName,
        })),
      })),
    },
  };
}

/** Reaplica a trilha de trocas sobre o snapshot de participantes. */
export function aplicarSwaps(itens, swaps) {
  const copia = itens.slice();
  for (const troca of swaps) {
    if (!Array.isArray(troca) || troca.length !== 2) {
      throw new Error("trilha de swaps inválida");
    }
    const [i, j] = troca;
    const valido =
      Number.isInteger(i) &&
      Number.isInteger(j) &&
      i >= 0 &&
      j >= 0 &&
      i < copia.length &&
      j < copia.length;
    if (!valido || i === j) throw new Error("trilha de swaps inválida");
    const auxiliar = copia[i];
    copia[i] = copia[j];
    copia[j] = auxiliar;
  }
  return copia;
}

/**
 * Monta o payload exato que será hasheado e publicado na ata.
 * A ordem das chaves não importa: canonicalJson ordena tudo antes do hash.
 */
export function montarPayloadAta({
  drawId,
  room,
  seq,
  participantes,
  mode,
  groupSize,
  swaps,
  result,
  verificationCode,
  prevHash,
  createdAt,
  createdByUserId,
}) {
  return {
    algorithm: "fisher-yates",
    algorithmVersion: 1,
    drawId,
    room: {
      id: room.id,
      publicCode: room.public_code,
      title: room.title,
    },
    seq,
    mode,
    groupSize: mode === "groups" ? groupSize : null,
    participants: participantes.map((pessoa) => ({
      participantId: pessoa.participantId,
      userId: pessoa.userId ?? null,
      displayName: pessoa.displayName,
      source: pessoa.source,
    })),
    swaps,
    result,
    verificationCode,
    prevHash: prevHash ?? null,
    createdAt,
    createdByUserId,
  };
}

/**
 * Reproduz o sorteio a partir do payload público da ata.
 * Usado pelo navegador (botão "Verificar integridade") e pelos testes.
 */
export function reproduzirResultado(payload) {
  const ordem = aplicarSwaps(payload.participants, payload.swaps);
  const esperado =
    payload.mode === "order"
      ? payload.result.order.map((item) => item.participantId)
      : payload.result.groups.flatMap((grupo) => grupo.members.map((item) => item.participantId));
  const obtido = ordem.map((pessoa) => pessoa.participantId);
  return {
    ok: JSON.stringify(esperado) === JSON.stringify(obtido),
    esperado,
    obtido,
  };
}
