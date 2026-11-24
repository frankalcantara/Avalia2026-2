/**
 * Middleware de /api/* (fica em functions/api/ para não ser invocado nas páginas estáticas,
 * cujos cabeçalhos vêm de public/_headers).
 *
 * 1. CSRF: POST/PUT/PATCH/DELETE exigem cabeçalho Origin idêntico à origem do site (senão 403).
 * 2. Corpo: com corpo, exige Content-Type application/json (senão 415) e no máximo 8 KB (senão 413).
 * 3. Carrega a sessão em context.data.usuario (null se não logado).
 * 4. Converte erros em JSON ({erro, mensagem}); erro inesperado → 500 {erro:"interno"} sem detalhe.
 * 5. Cabeçalhos de segurança + Cache-Control: no-store em toda resposta da API.
 */
import { ErroHttp, LIMITE_CORPO, ehJson, falha, respostaDeErro, temCorpo, erro } from "../_lib/http.js";
import { usuarioDaSessao } from "../_lib/sessao.js";

const METODOS_QUE_ALTERAM = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CABECALHOS_API = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function verificarRequisicao(request) {
  if (!METODOS_QUE_ALTERAM.has(request.method)) return;
  const origem = request.headers.get("Origin");
  if (origem === null || origem !== new URL(request.url).origin) {
    throw new ErroHttp(403, "origem_invalida", "Requisição bloqueada: origem não permitida (CSRF).");
  }
  if (temCorpo(request)) {
    const cl = request.headers.get("Content-Length");
    if (cl !== null && Number(cl) > LIMITE_CORPO) throw falha.corpoGrande();
    if (!ehJson(request)) throw falha.contentType();
  }
}

function comCabecalhos(resposta) {
  const r = new Response(resposta.body, resposta);
  for (const [k, v] of Object.entries(CABECALHOS_API)) r.headers.set(k, v);
  return r;
}

export async function onRequest(context) {
  const { request, env } = context;
  let resposta;
  try {
    verificarRequisicao(request);
    context.data.usuario = await usuarioDaSessao(env, request);
    resposta = await context.next();
  } catch (e) {
    if (e instanceof ErroHttp) {
      resposta = respostaDeErro(e);
    } else {
      const url = new URL(request.url);
      console.error(
        JSON.stringify({
          nivel: "erro",
          evento: "erro_interno",
          metodo: request.method,
          rota: url.pathname,
          erro: String((e && e.message) || e),
          pilha: e && e.stack,
        }),
      );
      resposta = erro(500, "interno", "Erro interno. Tente novamente mais tarde.");
    }
  }
  return comCabecalhos(resposta);
}
