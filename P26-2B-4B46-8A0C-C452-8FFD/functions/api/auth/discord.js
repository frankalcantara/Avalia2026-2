import { discordCallback, discordConfigured, randomToken, STATE_COOKIE } from "../../lib/auth.js";
import { appOrigin, cookie, json, redirect } from "../../lib/http.js";

export function onRequestGet({ request, env }) {
  if (!discordConfigured(env)) return json({ error: "Login Discord indisponível." }, 503);

  const url = new URL(request.url);
  const origin = appOrigin(request, env);
  if (url.origin !== origin) return redirect(origin + "/");

  const state = randomToken();
  const authorize = new URL("https://discord.com/api/oauth2/authorize");
  authorize.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: discordCallback(request, env),
    response_type: "code",
    scope: "identify",
    state,
  });
  return redirect(authorize.href, [cookie(STATE_COOKIE, state, 600)]);
}
