import { signValue } from "../_shared/auth.js";

const CALLBACK_PATH = "/api/auth/discord/callback";
const OAUTH_STATE_COOKIE = "discord_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 600;

function createState() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCallbackUrl(request) {
  const requestUrl = new URL(request.url);
  return new URL(CALLBACK_PATH, requestUrl.origin).href;
}

function getRedirectUri(configuredUri, callbackUrl) {
  if (!configuredUri) return callbackUrl;

  try {
    const configuredUrl = new URL(configuredUri);
    return configuredUrl.href === callbackUrl ? configuredUrl.href : callbackUrl;
  } catch {
    return callbackUrl;
  }
}

function stateCookie(value) {
  return `${OAUTH_STATE_COOKIE}=${value}; Path=${CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_STATE_TTL_SECONDS}; Secure`;
}

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !(env.SESSION_SECRET || env.DISCORD_CLIENT_SECRET)) {
    return Response.json(
      { ok: false, error: "oauth_not_configured" },
      { status: 503 },
    );
  }

  const state = createState();
  const signedState = await signValue(
    JSON.stringify({
      state,
      expiresAt: Date.now() + OAUTH_STATE_TTL_SECONDS * 1000,
    }),
    env,
  );

  const callbackUrl = getCallbackUrl(request);
  const redirectUri = getRedirectUri(env.DISCORD_REDIRECT_URI, callbackUrl);
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
      "Set-Cookie": stateCookie(signedState),
      "Cache-Control": "no-store",
    },
  });
}
