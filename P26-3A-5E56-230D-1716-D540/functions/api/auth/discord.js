/**
 * GET /api/auth/discord — inicia o login.
 * Gera `state` aleatório (32 bytes), grava no cookie oauth_state (HttpOnly, Secure, SameSite=Lax, 10 min,
 * Path=/api/auth/discord) e redireciona (302) ao Discord com scope=identify.
 * Sem OAuth configurado → 302 para /?erro_login=oauth_nao_configurado.
 */
import { porMetodo } from "../../_lib/http.js";
import { DISCORD_AUTHORIZE, oauthConfigurado, redirectUri } from "../../_lib/discord.js";
import { COOKIE_STATE, DURACAO_STATE_S, PATH_STATE, cookie, tokenAleatorio } from "../../_lib/sessao.js";

export const onRequest = porMetodo({
  GET: async ({ request, env }) => {
    const origem = new URL(request.url).origin;
    if (!oauthConfigurado(env)) {
      return new Response(null, {
        status: 302,
        headers: { Location: new URL("/?erro_login=oauth_nao_configurado", origem).href },
      });
    }
    const state = tokenAleatorio();
    const destino = new URL(DISCORD_AUTHORIZE);
    destino.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    destino.searchParams.set("redirect_uri", redirectUri(request));
    destino.searchParams.set("response_type", "code");
    destino.searchParams.set("scope", "identify");
    destino.searchParams.set("state", state);
    destino.searchParams.set("prompt", "none");

    return new Response(null, {
      status: 302,
      headers: {
        Location: destino.href,
        "Set-Cookie": cookie(COOKIE_STATE, state, { maxAge: DURACAO_STATE_S, path: PATH_STATE }),
      },
    });
  },
});
