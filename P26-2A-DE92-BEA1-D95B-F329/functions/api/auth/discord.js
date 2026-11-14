import { cookie, methodAllowed, OAUTH_COOKIE, randomToken, redirect, requireOAuth, signValue, withErrors } from "../../_lib.js";
export const onRequest = withErrors(async ({ request, env }) => {
  methodAllowed(request, ["GET"]);
  requireOAuth(env);
  const origin = new URL(request.url).origin;
  const state = randomToken();
  const signedState = await signValue(`${state}.${Date.now()}`, env.SESSION_SECRET);
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/discord/callback`,
    response_type: "code", scope: "identify", state,
  }).toString();
  return redirect(authorize.toString(), [cookie(OAUTH_COOKIE, signedState, 600)]);
});
