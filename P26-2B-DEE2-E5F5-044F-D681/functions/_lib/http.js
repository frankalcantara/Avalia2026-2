/**
 * Utilitários HTTP compartilhados pelas Pages Functions.
 * (Este arquivo não exporta onRequest*, então não vira rota.)
 */

export const CHAVE = "P26-2B-DEE2-E5F5-044F-D681";

export const TIPOS = ["perdi", "encontrei"];
export const CATEGORIAS = ["eletronicos", "documentos", "garrafas", "vestuario"];
export const STATUS_ITEM = ["aberto", "em_devolucao", "encerrado"];

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function erro(status, codigo, mensagem, detalhes) {
  return json({ ok: false, error: codigo, message: mensagem, ...(detalhes ? { details: detalhes } : {}) }, status);
}

/**
 * Lê o corpo JSON de uma requisição de escrita.
 * Exige Content-Type: application/json (bloqueia POST de formulários de outros sites = proteção CSRF)
 * e, se houver cabeçalho Origin, ele precisa ser o mesmo do site.
 */
export async function lerJson(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { erro: erro(403, "origem_invalida", "Requisição de outra origem não é permitida.") };
  }
  // compara o tipo de mídia exato (antes do ";"): "text/plain; application/json" não passa
  const ct = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (ct !== "application/json") {
    return { erro: erro(415, "content_type_invalido", "Envie o corpo como application/json.") };
  }
  const texto = await request.text();
  if (texto.length > 8000) {
    return { erro: erro(413, "corpo_grande", "Corpo da requisição muito grande.") };
  }
  try {
    const body = JSON.parse(texto || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return { body };
  } catch {
    return { erro: erro(400, "json_invalido", "JSON inválido.") };
  }
}

/** Normaliza texto: remove caracteres de controle e espaços repetidos nas pontas. */
export function texto(valor) {
  if (typeof valor !== "string") return "";
  return valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export function parseCookies(request) {
  const out = {};
  const header = request.headers.get("Cookie") || "";
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    const v = parte.slice(i + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v; // valor com "%" mal formado: mantém cru (não pode derrubar a API com 500)
    }
  }
  return out;
}

export function cookie(nome, valor, { maxAge, httpOnly = true, path = "/" } = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, `Path=${path}`, "SameSite=Lax", "Secure"];
  if (httpOnly) partes.push("HttpOnly");
  if (maxAge !== undefined) partes.push(`Max-Age=${maxAge}`);
  return partes.join("; ");
}

export function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null;
}
