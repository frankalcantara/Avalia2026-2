/**
 * Cloudflare Pages Function — GET /api/auth/discord/callback
 *
 * O Discord devolve o navegador para ca com um `code`. A troca por token
 * acontece servidor-a-servidor: o client secret existe apenas nesta chamada e
 * nunca chega ao navegador.
 *
 * DIFERENCA IMPORTANTE PARA O GOOGLE: o Discord nao devolve `id_token`. A
 * resposta tem so `access_token`, entao descobrir quem entrou exige uma
 * SEGUNDA chamada, a GET /users/@me. E o passo que a maioria dos tutoriais
 * esquece.
 */

import {
  criarSessao,
  montarCookie,
  lerCookie,
  NOME_COOKIE,
  DURACAO_SEGUNDOS,
} from "../../../_lib/sessao.js";

const TOKEN = "https://discord.com/api/oauth2/token";
const USUARIO = "https://discord.com/api/v10/users/@me";

function paginaDeErro(mensagem, status = 400) {
  // Mensagem generica de proposito: detalhe de falha de autenticacao vira
  // pista para quem esta sondando o endpoint.
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Erro no login</title>` +
      `<p>${mensagem}</p><p><a href="/">Voltar</a></p>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const seguro = url.protocol === "https:";

  if (url.searchParams.get("error")) return paginaDeErro("Login cancelado.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return paginaDeErro("Retorno incompleto do Discord.");

  if (state !== lerCookie(request, "oauth_state")) {
    return paginaDeErro("Sessao de login invalida. Tente novamente.", 403);
  }

  // A troca do codigo EXIGE application/x-www-form-urlencoded. A documentacao
  // do Discord e explicita: JSON e rejeitado.
  const respostaToken = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/api/auth/discord/callback`,
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
    }),
  });

  if (!respostaToken.ok) {
    // Nao registramos o corpo: ele pode conter o code e fragmentos de credencial.
    return paginaDeErro("Nao foi possivel concluir o login.", 502);
  }

  const { access_token: accessToken } = await respostaToken.json();
  if (!accessToken) return paginaDeErro("Resposta do Discord sem token.", 502);

  // Segunda chamada: quem e a pessoa. O Discord pede um User-Agent proprio em
  // chamadas a API HTTP e pode recusar requisicoes sem ele.
  const respostaUsuario = await fetch(USUARIO, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ResumosSnippets2B (https://p26-2b-273a-9914-8600-de35.pages.dev, 1.0)",
    },
  });

  if (!respostaUsuario.ok) return paginaDeErro("Nao foi possivel ler o perfil.", 502);

  const perfil = await respostaUsuario.json();
  if (!perfil?.id) return paginaDeErro("Perfil do Discord sem identificador.", 502);

  // `global_name` e o nome de exibicao atual; `username` e o handle. Guardamos
  // o que for mostravel, mas a CHAVE e sempre o `id`, que nao muda quando a
  // pessoa troca de nome.
  const nome = perfil.global_name || perfil.username || "Usuario";

  await env.DB.prepare(
    `INSERT INTO discord_users (user_id, username, avatar, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       username   = excluded.username,
       avatar     = excluded.avatar,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(String(perfil.id), nome, perfil.avatar ?? null)
    .run();

  const sessao = await criarSessao(String(perfil.id), env.SESSION_SECRET);

  const cabecalhos = new Headers({ Location: "/" });
  cabecalhos.append("Set-Cookie", montarCookie(NOME_COOKIE, sessao, DURACAO_SEGUNDOS, { seguro }));
  cabecalhos.append("Set-Cookie", montarCookie("oauth_state", "", 0, { seguro })); // apaga o state

  return new Response(null, { status: 302, headers: cabecalhos });
}
