import { buildCookie, json } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID) {
    return json(
      { ok: false, error: "Discord OAuth is not configured." },
      500,
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/discord/callback", request.url).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": buildCookie(request, "oauth_state", state, 10 * 60),
    },
  });
}
