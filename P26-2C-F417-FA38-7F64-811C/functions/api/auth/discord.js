import { createOAuthState } from "../_lib/auth.js";
import { isSecure, setCookie } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.SESSION_SECRET) {
    return new Response("Configuração OAuth incompleta no Cloudflare Pages.", { status: 500 });
  }

  const stateData = await createOAuthState(env);
  const state = stateData.state;
  const redirect = new URL("/api/auth/discord/callback", request.url).toString();

  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: "identify",
    state
  }).toString();

  const cookieValue = btoa(JSON.stringify({
    signed: stateData.token,
    state
  }));

  return new Response(null, {
    status: 302,
    headers: {
      "Location": url.toString(),
      "Set-Cookie": setCookie("ct_oauth", cookieValue, 600, isSecure(request))
    }
  });
}
