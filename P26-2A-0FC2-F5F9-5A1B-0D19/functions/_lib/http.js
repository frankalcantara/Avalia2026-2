// Utilitários HTTP compartilhados pelas Pages Functions.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
// Arquivo em _lib/ não exporta onRequest*, portanto não vira rota.

// Resposta JSON com cabeçalhos seguros e sem cache.
export function json(data, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  h.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { status, headers: h });
}

// Erro padronizado do SPEC: { ok:false, error, message }.
export function error(status, code, message, headers = {}) {
  return json({ ok: false, error: code, message }, status, headers);
}

// Atalhos para os erros mais comuns.
export const unauthorized = () =>
  error(401, "nao_autenticado", "Faça login com o Discord para continuar.");
export const methodNotAllowed = (allow) =>
  error(405, "metodo_nao_permitido", "Método HTTP não suportado nesta rota.", { Allow: allow });
export const notFoundPoll = () =>
  error(404, "enquete_nao_encontrada", "Enquete não encontrada.");
export const internalError = () =>
  error(500, "erro_interno", "Erro interno do servidor. Tente novamente.");

// Redirecionamento simples (302) com cabeçalhos extras (ex.: Set-Cookie).
export function redirect(location, cookies = []) {
  const h = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

// Anti-CSRF das rotas POST: exige JSON e Origin igual à origem da requisição.
// Retorna uma Response de erro ou null se a requisição for aceitável.
export function checkPost(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return error(403, "origem_invalida", "Origem da requisição não permitida.");
  }
  const ct = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!ct.startsWith("application/json")) {
    return error(400, "dados_invalidos", "Envie o corpo como application/json.");
  }
  return null;
}

// Lê o corpo JSON (objeto). Retorna { ok, value } ou { ok:false, response }.
export async function readJson(request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return { ok: true, value };
  } catch {
    return { ok: false, response: error(400, "dados_invalidos", "Corpo JSON inválido.") };
  }
}

// Converte o parâmetro de rota em inteiro positivo; null se inválido.
export function parseId(raw) {
  const s = String(raw ?? "");
  if (!/^[1-9]\d{0,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

// Envolve um handler: captura exceções inesperadas sem vazar stack.
export function safe(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (e) {
      console.error("Erro não tratado:", e && e.message);
      return internalError();
    }
  };
}
