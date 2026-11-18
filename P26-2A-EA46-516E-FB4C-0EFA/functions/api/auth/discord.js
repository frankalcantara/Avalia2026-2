import { cookie } from "../../_lib/sessao.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({ configured: false, message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET." });
  }
  const state = crypto.randomUUID();
  const redirectUri = env.DISCORD_REDIRECT_URI || new URL("/api/auth/discord/callback", request.url).href;
  const u = new URL("https://discord.com/api/oauth2/authorize");
  u.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { Location: u.href, "Set-Cookie": cookie("discord_state", state, 600) } });
}
