import {
  callbackUrl,
  clearAuthCookies,
  configuredOAuth,
  createOAuthState,
  getSessionSecret,
  makeStateCookie,
  methodNotAllowed,
} from "../../_shared/auth.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed("GET");

  try {
    const secret = getSessionSecret(env);
    const { clientId } = configuredOAuth(env);
    const state = createOAuthState();
    const authorize = new URL("https://discord.com/oauth2/authorize");
    authorize.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(request),
      response_type: "code",
      scope: "identify",
      state,
    }).toString();

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        "Cache-Control": "no-store",
        "Set-Cookie": await makeStateCookie(state, secret),
      },
    });
  } catch (error) {
    console.error("Could not start Discord OAuth.", error);
    const headers = new Headers();
    clearAuthCookies(headers);
    headers.set("Location", new URL("/?auth_error=configuration", request.url).href);
    return new Response(null, { status: 303, headers });
  }
}
