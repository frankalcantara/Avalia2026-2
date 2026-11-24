/**
 * Verificação da ata no navegador — sem servidor, sem dependências.
 *
 * Reproduz exatamente o que a Cloudflare Function fez:
 *   1. reconstrói o payload canônico (chaves ordenadas, sem espaços);
 *   2. calcula SHA-256 com WebCrypto;
 *   3. reaplica a trilha de swaps sobre o snapshot de participantes;
 *   4. compara com o resultado publicado.
 *
 * Se qualquer byte da ata for alterado, o hash não confere.
 */

const ALFABETO = "0123456789abcdef";

function bytesParaHex(bytes) {
  let saida = "";
  for (const byte of bytes) {
    saida += ALFABETO[byte >> 4] + ALFABETO[byte & 15];
  }
  return saida;
}

/** SHA-256 de uma string UTF-8, em hexadecimal minúsculo. */
export async function sha256Hex(texto) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Este navegador não oferece WebCrypto. Use um navegador atual em HTTPS.");
  }
  const dados = new TextEncoder().encode(String(texto));
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return bytesParaHex(new Uint8Array(digest));
}

/** JSON canônico: chaves ordenadas recursivamente e sem espaços. */
export function canonicalJson(valor) {
  if (valor === null) return "null";
  if (Array.isArray(valor)) {
    return `[${valor.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof valor === "object") {
    const chaves = Object.keys(valor)
      .filter((chave) => valor[chave] !== undefined)
      .sort();
    const corpo = chaves
      .map((chave) => `${JSON.stringify(chave)}:${canonicalJson(valor[chave])}`)
      .join(",");
    return `{${corpo}}`;
  }
  return JSON.stringify(valor);
}

/** Reaplica a trilha de trocas do Fisher-Yates. */
export function aplicarSwaps(itens, swaps) {
  const copia = itens.slice();
  for (const troca of swaps) {
    if (!Array.isArray(troca) || troca.length !== 2) {
      throw new Error("Trilha de trocas inválida.");
    }
    const [i, j] = troca;
    const valido =
      Number.isInteger(i) &&
      Number.isInteger(j) &&
      i >= 0 &&
      j >= 0 &&
      i < copia.length &&
      j < copia.length;
    if (!valido || i === j) throw new Error("Trilha de trocas inválida.");
    const auxiliar = copia[i];
    copia[i] = copia[j];
    copia[j] = auxiliar;
  }
  return copia;
}

/**
 * Confere a ata inteira no navegador.
 * @returns {Promise<{
 *   hashConfere: boolean,
 *   replayConfere: boolean,
 *   hashCalculado: string,
 *   hashPublicado: string,
 *   ordemReconstruida: number[],
 *   ordemPublicada: number[]
 * }>}
 */
export async function verificarAta(ata) {
  // Remove apenas os campos que a API acrescenta fora do payload hasheado.
  const {
    auditHash,
    prevDrawCode,
    verificationUrl,
    entries,
    ...payload
  } = ata;

  const hashCalculado = await sha256Hex(canonicalJson(payload));
  const ordemReconstruida = aplicarSwaps(payload.participants, payload.swaps).map(
    (pessoa) => pessoa.participantId
  );
  const ordemPublicada =
    payload.mode === "order"
      ? payload.result.order.map((item) => item.participantId)
      : payload.result.groups.flatMap((grupo) =>
          grupo.members.map((membro) => membro.participantId)
        );

  return {
    hashConfere: hashCalculado === ata.auditHash,
    replayConfere: JSON.stringify(ordemReconstruida) === JSON.stringify(ordemPublicada),
    hashCalculado,
    hashPublicado: ata.auditHash,
    ordemReconstruida,
    ordemPublicada,
  };
}
