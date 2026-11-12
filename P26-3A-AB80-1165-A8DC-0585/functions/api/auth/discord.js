
/**
 * DevGratitude - Projeto #29
 * Chave: P26-3A-AB80-1165-A8DC-0585
 *
 * Inicia a autenticação Discord OAuth2.
 */

export async function onRequestGet({ request, env }) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json(
      {
        error: "Autenticação Discord ainda não configurada."
      },
      { status: 503 }
    );
  }

  // Endereço oficial do projeto no Cloudflare Pages.
  // Deve ser exatamente igual ao cadastrado no Discord.
  const redirectUri =
    "https://projeto-p26-3a-ab80-1165-a8dc-0585.pages.dev/api/auth/discord/callback";

  // Gera um valor aleatório para proteger o fluxo OAuth2.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const state = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // Endereço de autorização do Discord.
  const authorizeUrl = new URL(
    "https://discord.com/oauth2/authorize"
  );

  authorizeUrl.searchParams.set(
    "client_id",
    env.DISCORD_CLIENT_ID
  );

  authorizeUrl.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  authorizeUrl.searchParams.set(
    "response_type",
    "code"
  );

  authorizeUrl.searchParams.set(
    "scope",
    "identify"
  );

  authorizeUrl.searchParams.set(
    "state",
    state
  );

  const headers = new Headers();

  headers.set("Location", authorizeUrl.toString());

  // Armazena o state em cookie seguro.
  headers.append(
    "Set-Cookie",
    [
      `discord_oauth_state=${state}`,
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/api/auth/discord",
      "Max-Age=600"
    ].join("; ")
  );

  headers.set("Cache-Control", "no-store");

  return new Response(null, {
    status: 302,
    headers
  });
}
