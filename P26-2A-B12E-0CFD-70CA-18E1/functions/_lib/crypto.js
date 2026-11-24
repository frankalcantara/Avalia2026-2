/**
 * Utilitários criptográficos e de serialização.
 *
 * Roda igual no Cloudflare Workers e no Node.js (>= 18) porque usa apenas
 * a WebCrypto disponível em `globalThis.crypto`. Nenhuma dependência externa.
 */

const ALFABETO_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Converte bytes em hexadecimal minúsculo. */
export function bytesToHex(bytes) {
  let saida = "";
  for (const byte of bytes) saida += byte.toString(16).padStart(2, "0");
  return saida;
}

/** SHA-256 de uma string UTF-8, em hexadecimal minúsculo. */
export async function sha256Hex(texto) {
  const dados = new TextEncoder().encode(String(texto));
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return bytesToHex(new Uint8Array(digest));
}

/** Bytes aleatórios criptográficos em hexadecimal. */
export function randomHex(quantidadeBytes = 16) {
  const buffer = new Uint8Array(quantidadeBytes);
  crypto.getRandomValues(buffer);
  return bytesToHex(buffer);
}

/**
 * Inteiro uniforme em [0, maxExclusive) sem viés de módulo.
 * Rejeita os valores que cairiam na faixa incompleta do espaço de 32 bits.
 */
export function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("randomInt exige um inteiro positivo");
  }
  const limite = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let valor = 0;
  do {
    crypto.getRandomValues(buffer);
    valor = buffer[0];
  } while (valor >= limite);
  return valor % maxExclusive;
}

/** String aleatória usando o alfabeto informado (Crockford por padrão). */
export function randomCode(tamanho = 8, alfabeto = ALFABETO_CROCKFORD) {
  let saida = "";
  for (let i = 0; i < tamanho; i += 1) {
    saida += alfabeto[randomInt(alfabeto.length)];
  }
  return saida;
}

/** Código público e humano da ata: SORT-XXXX-XXXX. */
export function codigoVerificacao() {
  return `SORT-${randomCode(4)}-${randomCode(4)}`;
}

/** Identificador opaco para salas e atas. */
export function novoId() {
  return randomHex(16);
}

/**
 * JSON canônico: chaves ordenadas recursivamente e sem espaços.
 * É a base do hash de auditoria — qualquer mudança de 1 byte muda o hash.
 */
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

/** Hash SHA-256 do JSON canônico de um objeto. */
export async function hashCanonico(payload) {
  return sha256Hex(canonicalJson(payload));
}
