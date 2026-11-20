import { database, RequestError, route } from "../../_lib/http.js";
import { cookie, randomToken, STATE_COOKIE } from "../../_lib/session.js";

export const onRequest = route({
  GET({ request, env }) {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
      throw new RequestError("Login Discord indisponível.", 503);
    }
    database(env);

    const state = randomToken();
    const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
    authorizeUrl.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: new URL("/api/auth/discord/callback", request.url).href,
      response_type: "code",
      scope: "identify",
      state,
    }).toString();

    return new Response(null, {
      status: 302,
      headers: {
        "Cache-Control": "no-store",
        Location: authorizeUrl.href,
        "Referrer-Policy": "no-referrer",
        "Set-Cookie": cookie(STATE_COOKIE, state, 600),
      },
    });
  },
});
