/**
 * Utilidades HTTP compartilhadas pelas Pages Functions.
 * Erro padrão do contrato: { "erro": "<codigo>", "mensagem": "<texto pt-BR>" } (+ "campos" em 400 de validação).
 */

import { validarId } from "./validacao.js";

export const LIMITE_CORPO = 8 * 1024; // 8 KB (docs/ESPECIFICACAO.md, seção 5)

export class ErroHttp extends Error {
  constructor(status, codigo, mensagem, extra) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.extra = extra;
  }
}

export function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cabecalhos },
  });
}

export function erro(status, codigo, mensagem, extra) {
  return json({ erro: codigo, mensagem, ...(extra || {}) }, status);
}

export function respostaDeErro(e) {
  return erro(e.status, e.codigo, e.message, e.extra);
}

// Atalhos para os códigos do contrato.
export const falha = {
  invalido: (mensagem = "Dados inválidos.", campos) =>
    new ErroHttp(400, "dados_invalidos", mensagem, campos ? { campos } : undefined),
  naoLogado: () => new ErroHttp(401, "nao_logado", "Faça login com o Discord para continuar."),
  semPermissao: (mensagem = "Você não tem permissão para esta ação.") => new ErroHttp(403, "sem_permissao", mensagem),
  naoEncontrado: (mensagem = "Recurso não encontrado.") => new ErroHttp(404, "nao_encontrado", mensagem),
  conflito: (mensagem = "Conflito de estado.") => new ErroHttp(409, "conflito", mensagem),
  contentType: () =>
    new ErroHttp(415, "content_type_invalido", "Envie o corpo como JSON (Content-Type: application/json)."),
  corpoGrande: () => new ErroHttp(413, "corpo_grande", `O corpo da requisição excede ${LIMITE_CORPO} bytes.`),
  limite: (mensagem) => new ErroHttp(429, "limite_excedido", mensagem),
};

/** true se o Content-Type é application/json (com ou sem parâmetros como charset). */
export function ehJson(request) {
  const ct = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  return ct === "application/json";
}

/** true se a requisição declara ter corpo. */
export function temCorpo(request) {
  const cl = request.headers.get("Content-Length");
  if (cl !== null) return Number(cl) > 0;
  return request.headers.has("Transfer-Encoding");
}

/** Lê o corpo como texto UTF-8, abortando ao passar de LIMITE_CORPO bytes (não bufferiza além do limite). */
async function lerCorpoLimitado(request) {
  const cl = request.headers.get("Content-Length");
  if (cl !== null && Number(cl) > LIMITE_CORPO) throw falha.corpoGrande();
  if (!request.body) return "";
  const leitor = request.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_CORPO) {
      await leitor.cancel();
      throw falha.corpoGrande();
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    bytes.set(p, pos);
    pos += p.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw falha.invalido("O corpo não é UTF-8 válido.");
  }
}

/** Lê e valida um corpo JSON obrigatório que deve ser um objeto. 415 / 413 / 400. */
export async function lerJson(request) {
  if (!ehJson(request)) throw falha.contentType();
  const texto = await lerCorpoLimitado(request);
  if (texto.trim() === "") throw falha.invalido("Corpo JSON vazio.");
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw falha.invalido("JSON malformado.");
  }
  if (dados === null || typeof dados !== "object" || Array.isArray(dados)) {
    throw falha.invalido("O corpo deve ser um objeto JSON.");
  }
  return dados;
}

/**
 * Despacha por método. Métodos não listados → 405 com Allow.
 * Uso: export const onRequest = porMetodo({ GET: fn, POST: fn });
 */
export function porMetodo(handlers) {
  const permitidos = Object.keys(handlers);
  if (handlers.GET && !handlers.HEAD) permitidos.push("HEAD");
  return async (context) => {
    const metodo = context.request.method;
    const h = handlers[metodo] || (metodo === "HEAD" ? handlers.GET : undefined);
    if (!h) {
      return json(
        { erro: "metodo_nao_permitido", mensagem: `Método ${metodo} não permitido nesta rota.` },
        405,
        { Allow: permitidos.join(", ") },
      );
    }
    return h(context);
  };
}

/** Exige usuário logado (carregado pelo middleware em context.data.usuario). */
export function exigirUsuario(context) {
  const u = context.data && context.data.usuario;
  if (!u) throw falha.naoLogado();
  return u;
}

/** true se o erro do D1 é violação de UNIQUE. */
export function ehViolacaoUnica(e) {
  return /UNIQUE constraint failed/i.test(String(e && (e.message || e)));
}

/** Id inteiro positivo de um parâmetro de rota; senão 400. */
export function idDaRota(valor) {
  const id = validarId(valor);
  if (id === null) throw falha.invalido("Identificador inválido.");
  return id;
}
