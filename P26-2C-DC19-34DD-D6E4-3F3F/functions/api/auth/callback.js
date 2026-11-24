import { parseCookies, serializeCookie, ehHttps, igualConstante } from "../../_lib/http.js";
import { redirectUri, trocarCodigo, buscarPerfil, upsertUsuario } from "../../_lib/discord.js";
import { criarSessao } from "../../_lib/session.js";

function voltar(request, destino, cookies) {
  const headers = new Headers({ Location: destino, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limpaState = serializeCookie("oauth_state", "", { maxAge: 0, path: "/api/auth", secure: ehHttps(request) });
  try {
    if (url.searchParams.get("error")) return voltar(request, "/?erro=login_cancelado", [limpaState]);

    const state = url.searchParams.get("state");
    const cookieState = parseCookies(request).oauth_state;
    if (!state || !cookieState || !igualConstante(state, cookieState)) {
      return voltar(request, "/?erro=estado_invalido", [limpaState]);
    }

    const code = url.searchParams.get("code");
    if (!code) return voltar(request, "/?erro=falha_discord", [limpaState]);

    const token = await trocarCodigo(env, code, redirectUri(env, request));
    const perfil = await buscarPerfil(token);
    const usuario = await upsertUsuario(env, perfil);
    const sessao = await criarSessao(env, request, usuario.id);
    return voltar(request, "/", [sessao.cookie, limpaState]);
  } catch (e) {
    console.error("Falha no callback do Discord:", e);
    return voltar(request, "/?erro=falha_discord", [limpaState]);
  }
}
