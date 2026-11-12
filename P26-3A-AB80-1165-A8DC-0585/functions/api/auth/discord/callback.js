
/**
 * DevGratitude - Projeto #29
 * Chave: P26-3A-AB80-1165-A8DC-0585
 *
 * Callback Discord OAuth2 com diagnóstico seguro.
 *
 * Variáveis:
 * DISCORD_CLIENT_ID
 * DISCORD_CLIENT_SECRET
 * SESSION_SECRET
 * DB
 */

const SITE_URL =
  "https://projeto-p26-3a-ab80-1165-a8dc-0585.pages.dev";

const REDIRECT_URI =
  SITE_URL + "/api/auth/discord/callback";

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";

  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="));

  return entry ? entry.slice(name.length + 1) : null;
}

function toBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signSession(payload, secret) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return toBase64Url(new Uint8Array(signature));
}

function redirectHome(error) {
  const destination = new URL("/", SITE_URL);

  destination.searchParams.set("auth_error", error);

  return Response.redirect(destination.toString(), 302);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const expectedState = getCookie(
    request,
    "discord_oauth_state"
  );

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState
  ) {
    return redirectHome("invalid_oauth_state");
  }

  if (
    !env.DISCORD_CLIENT_ID ||
    !env.DISCORD_CLIENT_SECRET ||
    !env.SESSION_SECRET ||
    !env.DB
  ) {
    console.error(
      "OAuth2: configuração obrigatória ausente."
    );

    return Response.json(
      {
        error: "Configuração incompleta do servidor."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    // Troca o código de autorização por um token.
    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI
        })
      }
    );

    if (!tokenResponse.ok) {
      // Registra apenas informações de diagnóstico.
      // Nunca registra códigos, tokens ou segredos.
      let errorCode = "unknown";
      let errorDescription = "unavailable";

      try {
        const discordError = await tokenResponse.json();

        errorCode = String(
          discordError.error || "unknown"
        );

        // Evita registrar descrições livres que
        // eventualmente contenham dados sensíveis.
        const allowedDescriptions = new Set([
          "Invalid client",
          "Invalid authorization code",
          "Invalid redirect_uri",
          "Invalid grant"
        ]);

        if (
          allowedDescriptions.has(
            discordError.error_description
          )
        ) {
          errorDescription =
            discordError.error_description;
        }
      } catch {
        errorCode = "unreadable_response";
      }

      console.error("Discord OAuth2 token exchange failed", {
        status: tokenResponse.status,
        error: errorCode,
        description: errorDescription
      });

      return redirectHome("token_exchange_failed");
    }

    const token = await tokenResponse.json();

    if (!token.access_token) {
      console.error(
        "Discord OAuth2: resposta sem access_token."
      );

      return redirectHome("missing_access_token");
    }

    // Consulta a identidade do usuário.
    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`
        }
      }
    );

    if (!userResponse.ok) {
      console.error(
        "Discord OAuth2: falha ao consultar usuário.",
        userResponse.status
      );

      return redirectHome("fetch_user_failed");
    }

    const discordUser = await userResponse.json();

    if (!discordUser.id) {
      return redirectHome("invalid_discord_user");
    }

    const userId = String(discordUser.id);

    const username = String(
      discordUser.global_name ||
      discordUser.username ||
      "Usuário Discord"
    );

    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    // Salva ou atualiza o usuário no D1.
    await env.DB.prepare(
      `INSERT INTO discord_users
       (user_id, username, avatar, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id)
       DO UPDATE SET
         username = excluded.username,
         avatar = excluded.avatar,
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(userId, username, avatar)
      .run();

    // Sessão válida por 24 horas.
    const session = {
      userId,
      username,
      avatar,
      exp: Math.floor(Date.now() / 1000) + 86400
    };

    const payload = toBase64Url(
      new TextEncoder().encode(
        JSON.stringify(session)
      )
    );

    const signature = await signSession(
      payload,
      env.SESSION_SECRET
    );

    const cookieValue = payload + "." + signature;

    const headers = new Headers();

    headers.set(
      "Location",
      SITE_URL + "/?login=success"
    );

    headers.set("Cache-Control", "no-store");

    headers.append(
      "Set-Cookie",
      [
        `discord_session=${cookieValue}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=86400"
      ].join("; ")
    );

    // Limpa o cookie temporário do OAuth2.
    headers.append(
      "Set-Cookie",
      [
        "discord_oauth_state=",
        "Path=/api/auth/discord",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=0"
      ].join("; ")
    );

    return new Response(null, {
      status: 302,
      headers
    });

  } catch (error) {
    // Não imprime dados sensíveis da requisição.
    console.error(
      "Falha inesperada no callback OAuth2:",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return redirectHome("authentication_failed");
  }
}
