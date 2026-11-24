/**
 * Cloudflare Pages Function — POST /api/auth/sair
 *
 * Apaga o cookie de sessao.
 *
 * E POST e nao GET de proposito: com GET, bastaria uma tag <img> apontando
 * para esta URL em qualquer site para deslogar quem visitasse a pagina. Com
 * POST e SameSite=Lax, isso nao acontece.
 */

import { montarCookie, NOME_COOKIE } from "../../_lib/sessao.js";

export async function onRequestPost({ request }) {
  const seguro = new URL(request.url).protocol === "https:";
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": montarCookie(NOME_COOKIE, "", 0, { seguro }) },
  });
}
