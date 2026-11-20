
/**
 * Cloudflare Pages Function — /api/auth/discord
 * Inicia a autenticação OAuth2 do Discord com proteção CSRF.
 */

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function assinar(valor, secret) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const assinatura = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(valor)
  );

  return base64url(new Uint8Array(assinatura));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    !env.SESSION_SECRET
  ) {
    return Response.json(
      { error: "Configuração OAuth2 incompleta." },
      { status: 500 }
    );
  }

  const redirectUri = new URL(
    "/api/auth/discord/callback",
    url.origin
  ).href;

  const state = base64url(
    crypto.getRandomValues(new Uint8Array(32))
  );

  const assinatura = await assinar(state, env.SESSION_SECRET);
  const cookieValue = `${state}.${assinatura}`;

  const authorizeUrl = new URL(
    "https://discord.com/oauth2/authorize"
  );

  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": `discord_oauth_state=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      "Cache-Control": "no-store"
    }
  });
}
