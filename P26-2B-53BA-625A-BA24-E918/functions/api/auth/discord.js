import { createOAuthState, callbackUri, requireDiscordConfig } from "../../_lib/auth.js";
import { errorResponse, methodNotAllowed } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    requireDiscordConfig(env);
    const { state, cookie } = await createOAuthState(env);
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", callbackUri(request, env));
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "identify");
    authorizeUrl.searchParams.set("state", state);
    return new Response(null, {
      status: 302,
      headers: { Location: authorizeUrl.href, "Set-Cookie": cookie },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET"]);
}
