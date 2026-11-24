export function embaralhar(participantes) {
  const lista = [...participantes];
  const numero = new Uint32Array(1);
  for (let i = lista.length - 1; i > 0; i--) {
    const opcoes = i + 1;
    const limite = 2 ** 32 - (2 ** 32 % opcoes);
    do {
      crypto.getRandomValues(numero);
    } while (numero[0] >= limite);
    const j = numero[0] % opcoes;
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

export function distribuir(participantes, modo, tamanho) {
  const lista = embaralhar(participantes);
  if (modo === "ordem") return lista.map((pessoa) => [pessoa]);
  const quantidade = Math.ceil(lista.length / tamanho);
  const equipes = Array.from({ length: quantidade }, () => []);
  lista.forEach((pessoa, indice) => equipes[indice % quantidade].push(pessoa));
  return equipes;
}

export async function sha256(texto) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(texto),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
