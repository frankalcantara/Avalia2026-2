/**
 * Camada HTTP das Cloudflare Pages Functions.
 * Respostas JSON padronizadas, cookies, leitura de corpo e checagem de origem.
 */

import { ErroValidacao } from "./validacao.js";

export class ErroHttp extends Error {
  constructor(status, codigo, mensagem, detalhes = undefined) {
    super(mensagem);
    this.name = "ErroHttp";
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

/** Resposta JSON com no-store e cookies opcionais. */
export function json(dados, { status = 200, headers = {}, cookies = [] } = {}) {
  const cabecalhos = new Headers(headers);
  cabecalhos.set("Content-Type", "application/json; charset=utf-8");
  cabecalhos.set("Cache-Control", "no-store");
  for (const cookie of cookies) cabecalhos.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(dados), { status, headers: cabecalhos });
}

export function semConteudo(status = 204, { cookies = [] } = {}) {
  const cabecalhos = new Headers();
  for (const cookie of cookies) cabecalhos.append("Set-Cookie", cookie);
  return new Response(null, { status, headers: cabecalhos });
}

export function redirecionar(location, { status = 302, cookies = [] } = {}) {
  const cabecalhos = new Headers({ Location: location });
  for (const cookie of cookies) cabecalhos.append("Set-Cookie", cookie);
  return new Response(null, { status, headers: cabecalhos });
}

/** Lê um cookie do request pelo nome. */
export function lerCookie(request, nome) {
  const cabecalho = request.headers.get("Cookie") || "";
  for (const parte of cabecalho.split(";")) {
    const separador = parte.indexOf("=");
    if (separador < 0) continue;
    const chave = parte.slice(0, separador).trim();
    if (chave !== nome) continue;
    const valor = parte.slice(separador + 1).trim();
    try {
      return decodeURIComponent(valor);
    } catch {
      return valor;
    }
  }
  return null;
}

/** Serializa um cookie de sessão seguro. */
export function criarCookie(nome, valor, opcoes = {}) {
  const {
    maxAge,
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    path = "/",
  } = opcoes;

  const partes = [`${nome}=${encodeURIComponent(valor)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (typeof maxAge === "number") partes.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (httpOnly) partes.push("HttpOnly");
  if (secure) partes.push("Secure");
  return partes.join("; ");
}

/** Cookie de expiração imediata. */
export function apagarCookie(nome, opcoes = {}) {
  return criarCookie(nome, "", { ...opcoes, maxAge: 0 });
}

/** Garante que o método HTTP está entre os permitidos. */
export function exigirMetodo(request, ...metodos) {
  if (!metodos.includes(request.method)) {
    throw new ErroHttp(405, "metodo_nao_permitido", `Método ${request.method} não permitido.`);
  }
}

/**
 * Lê e valida um corpo JSON.
 * Rejeita content-type errado, corpo grande demais, JSON inválido e arrays.
 */
export async function lerJson(request, { limite = 32768 } = {}) {
  const tipo = request.headers.get("Content-Type") || "";
  if (!tipo.toLowerCase().includes("application/json")) {
    throw new ErroHttp(415, "content_type", "Envie o corpo com Content-Type: application/json.");
  }

  const texto = await request.text();
  if (texto.length > limite) {
    throw new ErroHttp(413, "payload_grande", "Corpo da requisição muito grande.");
  }
  if (!texto.trim()) {
    throw new ErroHttp(400, "json_vazio", "Corpo JSON vazio.");
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new ErroHttp(400, "json_invalido", "JSON inválido.");
  }

  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new ErroHttp(400, "json_invalido", "O corpo deve ser um objeto JSON.");
  }
  return dados;
}

/**
 * Defesa extra contra CSRF em métodos que alteram estado.
 * SameSite=Lax já bloqueia POST cross-site; o Origin é a segunda barreira.
 */
export function verificarOrigem(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origem = request.headers.get("Origin");
  if (!origem) return;
  const esperado = new URL(request.url).origin;
  if (origem !== esperado) {
    throw new ErroHttp(403, "origem_invalida", "Origem da requisição não permitida.");
  }
}

/**
 * Sanitiza um destino de redirecionamento vindo da query string.
 * Só aceita caminhos internos ("/algo"), nunca URLs absolutas ou "//host".
 */
export function destinoSeguro(valor, padrao = "/") {
  const texto = String(valor ?? "").trim();
  if (!texto.startsWith("/") || texto.startsWith("//") || texto.includes("\\")) return padrao;
  // Evita header injection e esquemas disfarçados.
  if (/[\u0000-\u001f\u007f]/.test(texto)) return padrao;
  return texto.slice(0, 500);
}

/** Converte qualquer erro conhecido em resposta JSON consistente. */
export function responderErro(erro) {
  if (erro instanceof ErroHttp) {
    return json(
      { ok: false, erro: erro.codigo, mensagem: erro.message, detalhes: erro.detalhes },
      { status: erro.status }
    );
  }
  if (erro instanceof ErroValidacao) {
    return json(
      { ok: false, erro: erro.codigo, mensagem: erro.message, campos: erro.campos },
      { status: erro.status }
    );
  }
  console.error("[erro nao tratado]", erro);
  return json(
    { ok: false, erro: "interno", mensagem: "Erro interno inesperado." },
    { status: 500 }
  );
}
