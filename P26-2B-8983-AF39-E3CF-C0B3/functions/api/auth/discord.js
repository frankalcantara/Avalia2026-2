import { fail, json, methodNotAllowed, randomToken, stateCookie } from "../../_utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
      return json({ error: "Discord OAuth2 credentials are not configured" }, 503);
    }
    if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
      return json({ error: "SESSION_SECRET must contain at least 32 characters" }, 503);
    }
    const state = randomToken();
    const redirectUri = env.DISCORD_REDIRECT_URI || new URL("/api/auth/discord/callback", url.origin).href;
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "identify");
    authorizeUrl.searchParams.set("state", state);
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl.href,
        "Set-Cookie": stateCookie(state),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed("GET");
  return onRequestGet(context);
}
