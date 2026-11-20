import { tokenAleatorio } from "../../_lib/sessao.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return new Response("Variáveis DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET não configuradas.", { status: 500 });
  }
  const origem = new URL(request.url).origin;
  const state = tokenAleatorio();
  const parametros = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID.trim(),
    redirect_uri: `${origem}/api/auth/callback`,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "none",
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://discord.com/oauth2/authorize?${parametros}`,
      "Set-Cookie": `oauth_state=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
