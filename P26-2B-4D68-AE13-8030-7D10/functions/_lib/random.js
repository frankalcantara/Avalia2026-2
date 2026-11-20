// Bytes aleatórios do CSPRNG em hexadecimal minúsculo.
export function randomHex(byteCount) {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(byteCount)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
