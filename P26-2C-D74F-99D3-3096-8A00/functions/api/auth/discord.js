import { cookieString, STATE_COOKIE } from "../../_lib/session.js";

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.SESSION_SECRET) {
    return Response.json({ ok: false, error: "Servidor sem DISCORD_CLIENT_ID/SESSION_SECRET." }, { status: 500 });
  }
  const url = new URL(request.url);
  const state = crypto.randomUUID();

  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", new URL("/api/auth/discord/callback", url.origin).href);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);

  const headers = new Headers({ Location: authorize.href });
  headers.append("Set-Cookie", cookieString(request, STATE_COOKIE, state, 600));
  return new Response(null, { status: 302, headers });
}