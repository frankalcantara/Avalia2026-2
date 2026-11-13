/**
 * Validação das regras de negócio no servidor.
 *
 * Nada aqui depende do DOM ou do Cloudflare: são funções puras, usadas pelas
 * Pages Functions e pelos testes. O cliente pode validar também, mas a
 * decisão final é sempre tomada por este módulo.
 */

export const LIMITES = Object.freeze({
  tituloMin: 3,
  tituloMax: 80,
  nomeMin: 2,
  nomeMax: 60,
  participantesMax: 200,
  grupoMin: 2,
  grupoMax: 50,
  codigoSalaMin: 6,
  codigoSalaMax: 16,
});

export class ErroValidacao extends Error {
  constructor(mensagem, { codigo = "validacao", campos = [] } = {}) {
    super(mensagem);
    this.name = "ErroValidacao";
    this.codigo = codigo;
    this.status = 400;
    this.campos = campos;
  }
}

/** Remove caracteres de controle, colapsa espaços e apara as pontas. */
export function normalizarNome(valor) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave de comparação: sem acentos, minúscula e sem espaços duplicados. */
export function chaveComparacao(valor) {
  return normalizarNome(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function exigirTexto(valor, { campo, min, max }) {
  const texto = normalizarNome(valor);
  if (texto.length < min) {
    throw new ErroValidacao(`${campo} deve ter pelo menos ${min} caracteres.`, { campos: [campo] });
  }
  if (texto.length > max) {
    throw new ErroValidacao(`${campo} deve ter no máximo ${max} caracteres.`, { campos: [campo] });
  }
  return texto;
}

export function exigirInteiro(valor, { campo, min, max }) {
  const numero = typeof valor === "number" ? valor : Number(String(valor ?? "").trim());
  if (!Number.isInteger(numero)) {
    throw new ErroValidacao(`${campo} deve ser um número inteiro.`, { campos: [campo] });
  }
  if (numero < min || numero > max) {
    throw new ErroValidacao(`${campo} deve estar entre ${min} e ${max}.`, { campos: [campo] });
  }
  return numero;
}

/**
 * Valida o payload de criação/edição de sala.
 * @returns {{ title: string, mode: "groups"|"order", groupSize: number|null, allowJoin: boolean }}
 */
export function validarSala(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ErroValidacao("Corpo da requisição inválido.");
  }

  const title = exigirTexto(body.title, {
    campo: "title",
    min: LIMITES.tituloMin,
    max: LIMITES.tituloMax,
  });

  const mode = String(body.mode ?? "").trim().toLowerCase();
  if (mode !== "groups" && mode !== "order") {
    throw new ErroValidacao("mode deve ser 'groups' ou 'order'.", { campos: ["mode"] });
  }

  let groupSize = null;
  if (mode === "groups") {
    groupSize = exigirInteiro(body.groupSize ?? body.group_size, {
      campo: "groupSize",
      min: LIMITES.grupoMin,
      max: LIMITES.grupoMax,
    });
  }

  const allowJoin = body.allowJoin === undefined ? true : body.allowJoin === true || body.allowJoin === "true";

  return { title, mode, groupSize, allowJoin };
}

/**
 * Valida a lista de nomes enviada pelo organizador.
 * Aceita `nomes: string[]` ou `texto: "um por linha"`.
 * Rejeita duplicados dentro do payload e contra a lista já existente.
 */
export function validarNomes(body, existentes = []) {
  const bruto = Array.isArray(body?.nomes)
    ? body.nomes
    : typeof body?.texto === "string"
      ? body.texto.split(/\r?\n/)
      : null;

  if (!bruto) {
    throw new ErroValidacao("Envie 'nomes' (array) ou 'texto' (um nome por linha).", {
      campos: ["nomes"],
    });
  }
  if (bruto.length > LIMITES.participantesMax * 2) {
    throw new ErroValidacao(`Envie no máximo ${LIMITES.participantesMax} participantes por vez.`, {
      campos: ["nomes"],
    });
  }

  const nomes = [];
  const vistos = new Set(existentes.map(chaveComparacao));
  const duplicados = [];

  for (const item of bruto) {
    if (typeof item !== "string") {
      throw new ErroValidacao("Cada participante deve ser um texto.", { campos: ["nomes"] });
    }
    const nome = normalizarNome(item);
    if (!nome) continue;

    if (nome.length < LIMITES.nomeMin || nome.length > LIMITES.nomeMax) {
      throw new ErroValidacao(
        `Cada nome deve ter entre ${LIMITES.nomeMin} e ${LIMITES.nomeMax} caracteres: "${nome}".`,
        { campos: ["nomes"] }
      );
    }

    const chave = chaveComparacao(nome);
    if (vistos.has(chave)) {
      duplicados.push(nome);
      continue;
    }
    vistos.add(chave);
    nomes.push(nome);
  }

  if (duplicados.length > 0) {
    throw new ErroValidacao(
      `Participantes duplicados: ${duplicados.slice(0, 10).join(", ")}.`,
      { codigo: "duplicado", campos: ["nomes"] }
    );
  }

  if (nomes.length === 0) {
    throw new ErroValidacao("Informe ao menos um participante.", { campos: ["nomes"] });
  }

  if (nomes.length > LIMITES.participantesMax) {
    throw new ErroValidacao(`O limite é de ${LIMITES.participantesMax} participantes por sala.`, {
      campos: ["nomes"],
    });
  }

  return { nomes };
}

/** Normaliza o código público da sala (8 caracteres Crockford na geração). */
export function normalizarCodigoSala(valor) {
  const codigo = String(valor ?? "").trim().toUpperCase();
  if (!new RegExp(`^[A-Z0-9]{${LIMITES.codigoSalaMin},${LIMITES.codigoSalaMax}}$`).test(codigo)) {
    throw new ErroValidacao("Código de sala inválido.", { codigo: "codigo_invalido", campos: ["codigo"] });
  }
  return codigo;
}

/** Normaliza o código da ata: SORT-XXXX-XXXX. */
export function normalizarCodigoAta(valor) {
  const codigo = String(valor ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^SORT-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(codigo)) {
    throw new ErroValidacao("Código de ata inválido. Use o formato SORT-XXXX-XXXX.", {
      codigo: "codigo_invalido",
      campos: ["codigo"],
    });
  }
  return codigo;
}
