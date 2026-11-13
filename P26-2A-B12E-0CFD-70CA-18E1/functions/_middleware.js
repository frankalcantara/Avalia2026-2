/**
 * Middleware global das Pages Functions.
 *   - captura erros não tratados e devolve JSON consistente em /api/*
 *   - aplica cabeçalhos de segurança em todas as respostas
 */

import { responderErro } from "./_lib/http.js";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://cdn.discordapp.com",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export async function onRequest(context) {
  const { request, next } = context;
  let resposta;

  try {
    resposta = await next();
  } catch (erro) {
    console.error("[middleware]", erro?.name, erro?.message);
    resposta = responderErro(erro);
  }

  const cabecalhos = new Headers(resposta.headers);
  cabecalhos.set("X-Content-Type-Options", "nosniff");
  cabecalhos.set("X-Frame-Options", "DENY");
  cabecalhos.set("Referrer-Policy", "strict-origin-when-cross-origin");
  cabecalhos.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  cabecalhos.set("Content-Security-Policy", CSP);

  return new Response(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: cabecalhos,
  });
}
