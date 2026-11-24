// Utilidades criptográficas apenas com Web Crypto (sem pacotes externos).

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 32 bytes aleatórios em Base64URL sem preenchimento => 43 caracteres.
// Usado para o id da transação OAuth, o state e o id da sessão.
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function isToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

// SHA-256 em Base64URL: é só isso que o D1 guarda (nunca o valor bruto).
export async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

// Comparação em tempo constante para resumos codificados em texto.
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}
