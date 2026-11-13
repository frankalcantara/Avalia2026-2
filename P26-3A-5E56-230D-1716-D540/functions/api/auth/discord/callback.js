/**
 * GET /api/auth/discord/callback?code&state
 * Confere state (tempo constante) com o cookie oauth_state, troca o code, busca /users/@me,
 * faz upsert em `usuarios`, cria sessão (grava só o SHA-256 do token) e define o cookie `sessao`.
 * Sucesso → 302 /?login=ok. Erro → 302 /?erro_login=<codigo>:
 *   negado | state_invalido | oauth_nao_configurado | troca_falhou | perfil_falhou | interno
 * O cookie oauth_state é sempre expirado.
 */
import { porMetodo } from "../../../_lib/http.js";
import { DISCORD_ME, DISCORD_TOKEN, oauthConfigurado, perfilDoDiscord, redirectUri } from "../../../_lib/discord.js";
import {
  COOKIE_SESSAO,
  COOKIE_STATE,
  DURACAO_SESSAO_S,
  PATH_STATE,
  apagarSessaoAtual,
  cookie,
  cookieExpirado,
  iguaisTempoConstante,
  lerCookie,
  prepararNovaSessao,
} from "../../../_lib/sessao.js";

const TEMPO_LIMITE_MS = 8000;

function redirecionar(origem, caminho, cookies = []) {
  const headers = new Headers({ Location: new URL(caminho, origem).href });
  headers.append("Set-Cookie", cookieExpirado(COOKIE_STATE, PATH_STATE));
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

const falhou = (origem, codigo) => redirecionar(origem, `/?erro_login=${codigo}`);

export const onRequest = porMetodo({
  GET: async ({ request, env }) => {
    const url = new URL(request.url);
    const origem = url.origin;

    if (url.searchParams.has("error")) return falhou(origem, "negado");

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const stateCookie = lerCookie(request, COOKIE_STATE);
    if (
      !code ||
      code.length > 200 ||
      !state ||
      state.length > 200 ||
      !stateCookie ||
      !(await iguaisTempoConstante(state, stateCookie))
    ) {
      return falhou(origem, "state_invalido");
    }
    if (!oauthConfigurado(env)) return falhou(origem, "oauth_nao_configurado");

    try {
      const respToken = await fetch(DISCORD_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri(request),
        }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!respToken.ok) {
        console.error(JSON.stringify({ nivel: "aviso", evento: "oauth_troca_falhou", status: respToken.status }));
        return falhou(origem, "troca_falhou");
      }
      const dadosToken = await respToken.json(); // resposta pequena e de tamanho conhecido
      if (!dadosToken || typeof dadosToken.access_token !== "string") return falhou(origem, "troca_falhou");

      const respMe = await fetch(DISCORD_ME, {
        headers: { Authorization: `Bearer ${dadosToken.access_token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!respMe.ok) {
        console.error(JSON.stringify({ nivel: "aviso", evento: "oauth_perfil_falhou", status: respMe.status }));
        return falhou(origem, "perfil_falhou");
      }
      const perfil = perfilDoDiscord(await respMe.json());
      if (!perfil) return falhou(origem, "perfil_falhou");

      // Evita fixação de sessão: descarta a sessão anterior deste navegador, se houver.
      await apagarSessaoAtual(env, request);

      const { token, statements } = await prepararNovaSessao(env, perfil.user_id);
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO usuarios (user_id, username, nome_exibicao, avatar_url)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             username = excluded.username,
             nome_exibicao = excluded.nome_exibicao,
             avatar_url = excluded.avatar_url,
             atualizado_em = datetime('now')`,
        ).bind(perfil.user_id, perfil.username, perfil.nome_exibicao, perfil.avatar_url),
        ...statements,
      ]);

      return redirecionar(origem, "/?login=ok", [cookie(COOKIE_SESSAO, token, { maxAge: DURACAO_SESSAO_S })]);
    } catch (e) {
      console.error(JSON.stringify({ nivel: "erro", evento: "oauth_callback", erro: String(e && e.message) }));
      return falhou(origem, "interno");
    }
  },
});
