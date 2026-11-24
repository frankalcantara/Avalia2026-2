import { cookie, failure, randomToken, requireDatabase, sha256 } from "../../_shared.js";

export async function onRequestGet({ request, env }) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return failure("oauth_not_configured", 503, "Configure as credenciais OAuth2 do Discord.");
  }

  const state = await randomToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
  await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(createdAt.toISOString()).run();
  await env.DB.prepare(
    "INSERT INTO oauth_states (state_hash, created_at, expires_at) VALUES (?, ?, ?)"
  ).bind(await sha256(state), createdAt.toISOString(), expiresAt.toISOString()).run();

  const origin = new URL(request.url).origin;
  const redirectUri = new URL("/api/auth/discord/callback", origin).href;
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
      "Cache-Control": "no-store",
      "Set-Cookie": cookie("discord_oauth_state", state, 600, "/api/auth/discord/callback"),
    },
  });
}
