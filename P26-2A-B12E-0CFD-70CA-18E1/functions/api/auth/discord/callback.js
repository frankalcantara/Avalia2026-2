/**
 * GET /api/auth/discord/callback
 * Valida o `state`, troca o code pelo token, importa apenas os dados públicos
 * do Discord (user_id, username, global_name, avatar) e cria a sessão.
 */

import { buscarPerfil, trocarCodigo, urlAvatar } from "../../../_lib/discord.js";
import { salvarUsuarioDiscord } from "../../../_lib/db.js";
import { iniciarSessao } from "../../../_lib/sessao.js";
import { apagarCookie, destinoSeguro, lerCookie, redirecionar } from "../../../_lib/http.js";

const COOKIE_STATE = "sorteio_oauth_state";

function falha(codigo, estado = null) {
  return redirecionar(`/?auth_error=${encodeURIComponent(codigo)}`, {
    cookies: estado ? [estado] : [],
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const seguro = url.protocol === "https:";
  const limparState = apagarCookie(COOKIE_STATE, {
    httpOnly: true,
    secure: seguro,
    sameSite: "Lax",
    path: "/api/auth/discord",
  });

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return falha("nao_configurado", limparState);
  }

  if (url.searchParams.get("error")) {
    return falha("discord_recusou", limparState);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return falha("callback_incompleto", limparState);

  // Valida o state contra CSRF de login.
  let salvo = null;
  try {
    salvo = JSON.parse(lerCookie(request, COOKIE_STATE) || "null");
  } catch {
    salvo = null;
  }
  if (!salvo || typeof salvo.state !== "string" || salvo.state !== state) {
    return falha("state_invalido", limparState);
  }

  try {
    const token = await trocarCodigo(env, request, code);
    const perfil = await buscarPerfil(token.access_token);

    const username = perfil.username;
    const globalName = typeof perfil.global_name === "string" ? perfil.global_name.trim() : null;
    const avatar = urlAvatar(perfil);

    await salvarUsuarioDiscord(env, {
      userId: perfil.id,
      username,
      globalName: globalName || null,
      avatar,
    });

    const sessao = await iniciarSessao(env, request, perfil.id);
    const destino = destinoSeguro(salvo.next, "/");
    const separador = destino.includes("?") ? "&" : "?";
    const alvo = destino === "/" ? "/?login=success" : `${destino}${separador}login=success`;

    return redirecionar(alvo, { cookies: [sessao.cookie, limparState] });
  } catch (erro) {
    console.error("[auth/callback]", erro?.name, erro?.message);
    return falha("falha_login", limparState);
  }
}
