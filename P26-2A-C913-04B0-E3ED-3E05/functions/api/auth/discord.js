import { signValue } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !(env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET)) {
    return Response.json({ ok: false, error: "oauth_not_configured" }, { status: 503 });
  }
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const state = Array.from(random, byte => byte.toString(16).padStart(2, "0")).join("");
  const signedState = await signValue(JSON.stringify({ state, expiresAt: Date.now() + 600000 }), env);
  const url = new URL(request.url);
  const callbackUrl = new URL("/api/auth/discord/callback", url.origin).href;
  let redirectUri = callbackUrl;
  if (env.DISCORD_REDIRECT_URI) {
    try { if (new URL(env.DISCORD_REDIRECT_URI).href === callbackUrl) redirectUri = env.DISCORD_REDIRECT_URI; } catch {}
  }
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: {
    Location: authorizeUrl.href,
    "Set-Cookie": `discord_oauth_state=${signedState}; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=600; Secure`,
    "Cache-Control": "no-store",
  } });
}
