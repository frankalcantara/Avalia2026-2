import { createStateCookie } from "../../_shared/session.js";
import { json, redirect } from "../../_shared/http.js";

export async function onRequestGet({ request, env }) {
  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    !env.SESSION_SECRET ||
    new TextEncoder().encode(env.SESSION_SECRET).length < 32 ||
    !env.DB
  ) {
    return json({ error: "Autenticação Discord ou banco D1 não configurado corretamente." }, 503);
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: new URL("/api/auth/discord/callback", request.url).href,
    response_type: "code",
    scope: "identify",
    state,
  }).toString();

  return redirect(authorizeUrl.toString(), {
    "Set-Cookie": await createStateCookie(state, env.SESSION_SECRET),
  });
}
