/**
 * Cliente mínimo do Discord OAuth2.
 *
 * Escopo `identify` apenas: o projeto não pede e-mail, guildas nem permissões
 * além de `user_id`, username, global_name e avatar.
 */

import { ErroHttp } from "./http.js";

const API = "https://discord.com/api";
const AUTORIZAR = "https://discord.com/oauth2/authorize";
const ESCOPO = "identify";

/** URL canônica do callback — precisa bater exatamente com o Redirect do portal. */
export function urlCallback(request) {
  return new URL("/api/auth/discord/callback", request.url).href;
}

/** Monta a URL de autorização com `state` contra CSRF de login. */
export function urlAutorizacao(request, clientId, state) {
  const url = new URL(AUTORIZAR);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", urlCallback(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPO);
  url.searchParams.set("state", state);
  return url.href;
}

/** Troca o authorization code pelo access token (com timeout de 10 s). */
export async function trocarCodigo(env, request, code) {
  const resposta = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: urlCallback(request),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resposta.ok) {
    throw new ErroHttp(502, "discord_token", "O Discord recusou a troca do código de autorização.");
  }

  const dados = await resposta.json();
  if (!dados || typeof dados.access_token !== "string") {
    throw new ErroHttp(502, "discord_token", "Resposta inválida do Discord ao trocar o código.");
  }
  return dados;
}

/** Busca o perfil do usuário autenticado. */
export async function buscarPerfil(accessToken) {
  const resposta = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resposta.ok) {
    throw new ErroHttp(502, "discord_perfil", "Não foi possível obter o perfil do Discord.");
  }

  const perfil = await resposta.json();
  if (!perfil || typeof perfil.id !== "string" || typeof perfil.username !== "string") {
    throw new ErroHttp(502, "discord_perfil", "Perfil do Discord em formato inesperado.");
  }
  return perfil;
}

/**
 * URL do avatar em tamanho fixo (128px).
 * Usuários sem avatar recebem um dos 6 padrões oficiais, derivado do user_id.
 */
export function urlAvatar(perfil) {
  if (perfil.avatar) {
    return `https://cdn.discordapp.com/avatars/${perfil.id}/${perfil.avatar}.png?size=128`;
  }
  let indice = 0;
  try {
    indice = Number((BigInt(perfil.id) >> 22n) % 6n);
  } catch {
    indice = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${indice}.png`;
}

/** Nome exibível: global_name quando existir, senão o username. */
export function nomeExibicao(perfil) {
  const global = typeof perfil.global_name === "string" ? perfil.global_name.trim() : "";
  return global || perfil.username;
}
