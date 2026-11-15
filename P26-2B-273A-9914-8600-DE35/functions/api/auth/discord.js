/**
 * Cloudflare Pages Function — GET /api/auth/discord
 *
 * Inicio do fluxo OAuth2: monta a URL de autorizacao do Discord e redireciona
 * o navegador para la. Nenhum segredo trafega aqui — a URL leva apenas o
 * client_id, que e publico por natureza.
 */

import { montarCookie } from "../../_lib/sessao.js";

const AUTORIZACAO = "https://discord.com/oauth2/authorize";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json(
      {
        configured: false,
        message:
          "Defina DISCORD_CLIENT_ID no wrangler.jsonc e DISCORD_CLIENT_SECRET como segredo do Pages.",
      },
      { status: 503 }
    );
  }

  // O state protege o login contra CSRF. O mesmo valor vai para o Discord e
  // para um cookie curto; no retorno os dois tem que bater. Sem isso, um site
  // hostil consegue induzir o seu navegador a concluir um login com a conta
  // DELE, e voce passa a publicar resumos na identidade do atacante sem notar.
  //
  // A documentacao do Discord diz que o state e opcional e recomenda usar.
  const state = crypto.randomUUID();

  const parametros = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/discord/callback`,
    response_type: "code",
    // `identify` basta: devolve id, username, global_name e avatar — exatamente
    // o que o enunciado pede. Nao pedimos `email`, porque o projeto nao precisa
    // e todo escopo a mais e dado pessoal que passa a ser nossa responsabilidade.
    scope: "identify",
    state,
    prompt: "consent",
  });

  const cabecalhos = new Headers({ Location: `${AUTORIZACAO}?${parametros}` });
  cabecalhos.append(
    "Set-Cookie",
    // Dez minutos: tempo de sobra para escolher a conta, curto o bastante para
    // o valor nao ficar valido pendurado no navegador.
    montarCookie("oauth_state", state, 600, { seguro: url.protocol === "https:" })
  );

  return new Response(null, { status: 302, headers: cabecalhos });
}
