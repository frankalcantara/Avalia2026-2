import {
  authCookie, checkAuthConfig, OAUTH_CALLBACK, OAUTH_COOKIE, OAUTH_SECONDS, signToken,
} from "../../_lib/auth.js";
import { redirect } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  checkAuthConfig(env);

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: new URL(OAUTH_CALLBACK, request.url).href,
    scope: "identify",
    state,
  }).toString();

  const token = await signToken(env, "oauth", state);
  return redirect(request, authorizeUrl, [authCookie(request, OAUTH_COOKIE, token, OAUTH_SECONDS)]);
}
