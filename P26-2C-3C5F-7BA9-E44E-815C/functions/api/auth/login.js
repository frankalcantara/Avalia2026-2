import { randomToken, cookie } from "../../../lib/util.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = randomToken(16);
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/callback`,
    response_type: "code",
    scope: "identify",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: `https://discord.com/oauth2/authorize?${params}`, "Set-Cookie": cookie("oauth_state", state, 600) },
  });
}
