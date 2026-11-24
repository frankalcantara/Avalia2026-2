/**
 * Validadores PUROS do back-end (sem APIs do Workers, sem D1) — importáveis no Node:
 *   import { validarItem } from "../functions/_lib/validacao.js";
 *
 * Todos retornam { ok: boolean, valor, erros }, onde `erros` é um objeto { campo: "mensagem pt-BR" }
 * (vazio quando ok). Contrato: docs/ESPECIFICACAO.md, seções 4.1, 4.2 e 4.3.
 *
 * Decisões onde o contrato é ambíguo:
 * - Tamanho é contado em caracteres Unicode (code points: [...texto].length), igual ao length() do SQLite.
 * - Limpeza de texto: \t \n \r viram espaço; demais caracteres de controle (C0, DEL, C1) e controles
 *   de direção bidi (U+202A–U+202E, U+2066–U+2069) são removidos; espaços repetidos são colapsados; trim().
 * - "Hoje" é o dia civil do campus (America/Sao_Paulo). data_ocorrencia aceita de (hoje − 1 ano) até hoje,
 *   inclusive nas duas pontas.
 * - Filtro com valor vazio (ex.: `tipo=`) é tratado como ausente; parâmetros desconhecidos são ignorados.
 */

export const TIPOS = Object.freeze(["perdi", "encontrei"]);
export const CATEGORIAS = Object.freeze(["eletronicos", "documentos", "garrafas", "vestuario"]);
export const STATUS_ITEM = Object.freeze(["aberto", "em_devolucao", "encerrado"]);
export const STATUS_REIVINDICACAO = Object.freeze(["pendente", "aceita", "recusada", "cancelada", "concluida"]);
export const ORDENS = Object.freeze(["recentes", "antigos"]);

export const LIMITES = Object.freeze({
  titulo: [3, 80],
  descricao: [10, 1000],
  local: [3, 120],
  mensagem: [10, 500],
  q: 60,
  filtroLocal: 120,
  porPaginaMax: 50,
  porPaginaPadrao: 12,
  paginaMax: 10000,
});

export const FUSO_CAMPUS = "America/Sao_Paulo";

// eslint-disable-next-line no-control-regex
const RE_CONTROLE_ESPACO = /[\t\n\r]/g;
// eslint-disable-next-line no-control-regex
const RE_CONTROLE = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Conta caracteres Unicode (code points), não unidades UTF-16. */
export function tamanho(texto) {
  return [...texto].length;
}

/**
 * Limpa um valor textual: só aceita string; troca \t\n\r por espaço, remove caracteres de
 * controle e bidi, colapsa espaços e faz trim(). Retorna null se não for string.
 */
export function limparTexto(valor) {
  if (typeof valor !== "string") return null;
  return valor
    .replace(RE_CONTROLE_ESPACO, " ")
    .replace(RE_CONTROLE, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

function validarTexto(valor, campo, [min, max], erros) {
  const limpo = limparTexto(valor);
  if (limpo === null) {
    erros[campo] = `O campo ${campo} é obrigatório e deve ser texto.`;
    return null;
  }
  const n = tamanho(limpo);
  if (n < min || n > max) {
    erros[campo] = `O campo ${campo} deve ter entre ${min} e ${max} caracteres.`;
    return null;
  }
  return limpo;
}

/** Data civil (YYYY-MM-DD) de `agora` no fuso do campus. */
export function hojeNoCampus(agora = new Date()) {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_CAMPUS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** true se `texto` é YYYY-MM-DD de uma data de calendário existente. */
export function dataValida(texto) {
  if (typeof texto !== "string") return false;
  const m = RE_DATA.exec(texto);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Mesma data de `hoje` (YYYY-MM-DD) um ano antes; 29/02 vira 28/02. */
export function umAnoAntes(hoje) {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const anoAnt = ano - 1;
  const ultimoDia = new Date(Date.UTC(anoAnt, mes, 0)).getUTCDate();
  const d = Math.min(dia, ultimoDia);
  return `${String(anoAnt).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Valida data_ocorrencia: formato, data real, não futura, não anterior a 1 ano. */
export function validarDataOcorrencia(valor, agora = new Date()) {
  const erros = {};
  if (!dataValida(valor)) {
    erros.data_ocorrencia = "Data inválida: use o formato AAAA-MM-DD com uma data existente.";
    return { ok: false, valor: null, erros };
  }
  const hoje = hojeNoCampus(agora);
  if (valor > hoje) {
    erros.data_ocorrencia = "A data não pode estar no futuro.";
  } else if (valor < umAnoAntes(hoje)) {
    erros.data_ocorrencia = "A data não pode ser anterior a 1 ano.";
  }
  const ok = Object.keys(erros).length === 0;
  return { ok, valor: ok ? valor : null, erros };
}

function ehObjetoSimples(corpo) {
  return corpo !== null && typeof corpo === "object" && !Array.isArray(corpo);
}

/**
 * Valida o corpo de POST /api/itens. Campos extras são ignorados.
 * @param {unknown} corpo objeto JSON já parseado
 * @param {Date} [agora] relógio injetável para testes
 */
export function validarItem(corpo, agora = new Date()) {
  const erros = {};
  if (!ehObjetoSimples(corpo)) {
    return { ok: false, valor: null, erros: { corpo: "O corpo deve ser um objeto JSON." } };
  }
  const tipo = corpo.tipo;
  if (typeof tipo !== "string" || !TIPOS.includes(tipo)) {
    erros.tipo = `Tipo inválido: use ${TIPOS.join(" ou ")}.`;
  }
  const categoria = corpo.categoria;
  if (typeof categoria !== "string" || !CATEGORIAS.includes(categoria)) {
    erros.categoria = `Categoria inválida: use ${CATEGORIAS.join(", ")}.`;
  }
  const titulo = validarTexto(corpo.titulo, "titulo", LIMITES.titulo, erros);
  const descricao = validarTexto(corpo.descricao, "descricao", LIMITES.descricao, erros);
  const local = validarTexto(corpo.local, "local", LIMITES.local, erros);
  const data = validarDataOcorrencia(corpo.data_ocorrencia, agora);
  if (!data.ok) Object.assign(erros, data.erros);

  const ok = Object.keys(erros).length === 0;
  return {
    ok,
    valor: ok ? { tipo, categoria, titulo, descricao, local, data_ocorrencia: data.valor } : null,
    erros,
  };
}

/** Valida o corpo de POST /api/itens/:id/reivindicacoes ({ mensagem }). */
export function validarReivindicacao(corpo) {
  if (!ehObjetoSimples(corpo)) {
    return { ok: false, valor: null, erros: { corpo: "O corpo deve ser um objeto JSON." } };
  }
  const erros = {};
  const mensagem = validarTexto(corpo.mensagem, "mensagem", LIMITES.mensagem, erros);
  const ok = Object.keys(erros).length === 0;
  return { ok, valor: ok ? { mensagem } : null, erros };
}

/** Converte um parâmetro de rota em id inteiro positivo, ou null. */
export function validarId(valor) {
  if (typeof valor !== "string" || !/^[1-9]\d{0,14}$/.test(valor)) return null;
  return Number(valor);
}

function inteiroEntre(texto, min, max) {
  if (!/^\d{1,6}$/.test(texto)) return null;
  const n = Number(texto);
  return n >= min && n <= max ? n : null;
}

/**
 * Valida os filtros de GET /api/itens.
 * @param {URLSearchParams} params
 * @returns {{ ok, valor: { tipo, categoria, status, q, local, de, ate, meus, ordem, pagina, por_pagina }, erros }}
 *   `status` vale null quando o padrão (todos menos encerrado) deve ser usado, ou "todos".
 */
export function validarFiltros(params) {
  const erros = {};
  const pegar = (nome) => {
    const v = params.get(nome);
    return v === null || v === "" ? null : v;
  };
  const valor = {
    tipo: null,
    categoria: null,
    status: null,
    q: null,
    local: null,
    de: null,
    ate: null,
    meus: false,
    ordem: "recentes",
    pagina: 1,
    por_pagina: LIMITES.porPaginaPadrao,
  };

  const tipo = pegar("tipo");
  if (tipo !== null) {
    if (TIPOS.includes(tipo)) valor.tipo = tipo;
    else erros.tipo = `Filtro tipo inválido: use ${TIPOS.join(" ou ")}.`;
  }
  const categoria = pegar("categoria");
  if (categoria !== null) {
    if (CATEGORIAS.includes(categoria)) valor.categoria = categoria;
    else erros.categoria = `Filtro categoria inválido: use ${CATEGORIAS.join(", ")}.`;
  }
  const status = pegar("status");
  if (status !== null) {
    if (status === "todos" || STATUS_ITEM.includes(status)) valor.status = status;
    else erros.status = `Filtro status inválido: use ${STATUS_ITEM.join(", ")} ou todos.`;
  }
  const q = pegar("q");
  if (q !== null) {
    const limpo = limparTexto(q);
    if (tamanho(limpo) > LIMITES.q) erros.q = `A busca deve ter no máximo ${LIMITES.q} caracteres.`;
    else if (limpo !== "") valor.q = limpo;
  }
  const local = pegar("local");
  if (local !== null) {
    const limpo = limparTexto(local);
    if (tamanho(limpo) > LIMITES.filtroLocal) erros.local = `O filtro local deve ter no máximo ${LIMITES.filtroLocal} caracteres.`;
    else if (limpo !== "") valor.local = limpo;
  }
  for (const nome of ["de", "ate"]) {
    const v = pegar(nome);
    if (v === null) continue;
    if (dataValida(v)) valor[nome] = v;
    else erros[nome] = `Filtro ${nome} inválido: use AAAA-MM-DD.`;
  }
  if (valor.de && valor.ate && valor.de > valor.ate) {
    erros.ate = "O filtro ate deve ser igual ou posterior a de.";
  }
  const meus = pegar("meus");
  if (meus !== null) {
    if (meus === "1") valor.meus = true;
    else if (meus === "0") valor.meus = false;
    else erros.meus = "Filtro meus inválido: use 1.";
  }
  const ordem = pegar("ordem");
  if (ordem !== null) {
    if (ORDENS.includes(ordem)) valor.ordem = ordem;
    else erros.ordem = `Filtro ordem inválido: use ${ORDENS.join(" ou ")}.`;
  }
  const pagina = pegar("pagina");
  if (pagina !== null) {
    const n = inteiroEntre(pagina, 1, LIMITES.paginaMax);
    if (n === null) erros.pagina = `pagina deve ser um inteiro entre 1 e ${LIMITES.paginaMax}.`;
    else valor.pagina = n;
  }
  const porPagina = pegar("por_pagina");
  if (porPagina !== null) {
    const n = inteiroEntre(porPagina, 1, LIMITES.porPaginaMax);
    if (n === null) erros.por_pagina = `por_pagina deve ser um inteiro entre 1 e ${LIMITES.porPaginaMax}.`;
    else valor.por_pagina = n;
  }

  const ok = Object.keys(erros).length === 0;
  return { ok, valor: ok ? valor : null, erros };
}
