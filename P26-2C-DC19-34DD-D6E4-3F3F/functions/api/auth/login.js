import { bytesHex, serializeCookie, ehHttps, erro, erroInterno } from "../../_lib/http.js";
import { montarUrlAutorizacao, redirectUri } from "../../_lib/discord.js";

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DISCORD_CLIENT_ID) return erro(500, "Login com Discord não configurado.");
    const state = bytesHex(16);
    const url = montarUrlAutorizacao({
      clientId: env.DISCORD_CLIENT_ID,
      redirectUri: redirectUri(env, request),
      state,
    });
    const headers = new Headers({ Location: url, "Cache-Control": "no-store" });
    headers.append(
      "Set-Cookie",
      serializeCookie("oauth_state", state, { maxAge: 600, path: "/api/auth", secure: ehHttps(request) })
    );
    return new Response(null, { status: 302, headers });
  } catch (e) {
    return erroInterno(e);
  }
}
