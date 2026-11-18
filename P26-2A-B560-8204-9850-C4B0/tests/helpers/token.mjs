/**
 * Assinador HMAC de tokens independente da implementação do projeto.
 *
 * Usa apenas `node:crypto` + `Buffer`, reimplementando o formato
 * (`base64url(payload).base64url(hmac)`) para que os testes possam forjar
 * tokens expirados, adulterados ou com payload arbitrário — e para detectar
 * divergências na implementação real (Web Crypto) em vez de espelhar seus bugs.
 *
 * @module tests/helpers/token
 */

import { createHmac } from "node:crypto";

/**
 * Codifica bytes em base64url sem padding.
 *
 * @param {Buffer | Uint8Array | string} value Bytes ou texto UTF-8.
 * @returns {string} String base64url.
 */
export function toBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Calcula a assinatura HMAC-SHA256 (base64url) de um segmento.
 *
 * @param {string} segment Segmento base64url.
 * @param {string} secret Segredo HMAC.
 * @returns {string} Assinatura base64url.
 */
export function signSegment(segment, secret) {
  return toBase64Url(createHmac("sha256", secret).update(segment, "utf8").digest());
}

/**
 * Monta um token no formato do projeto a partir de um payload arbitrário.
 *
 * @param {string} secret Segredo HMAC.
 * @param {Record<string, unknown> | string | Buffer} payload Payload (objeto é serializado em JSON).
 * @returns {string} Token `payload.signature`.
 */
export function signToken(secret, payload) {
  const raw =
    typeof payload === "string" || Buffer.isBuffer(payload)
      ? Buffer.isBuffer(payload)
        ? payload
        : Buffer.from(payload, "utf8")
      : Buffer.from(JSON.stringify(payload), "utf8");
  const segment = toBase64Url(raw);
  return `${segment}.${signSegment(segment, secret)}`;
}

/**
 * Gera um payload de sessão com tempos controlados.
 *
 * @param {{ uid?: string, name?: string, avatar?: string, iat?: number, exp?: number }} [overrides] Campos.
 * @returns {{ uid: string, name: string, avatar: string, iat: number, exp: number }} Payload.
 */
export function sessionPayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    uid: "100000000000000001",
    name: "leo",
    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    iat: now,
    exp: now + 604800,
    ...overrides,
  };
}
