
/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Valida o state OAuth2, autentica o usuário e cria uma sessão assinada.
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

function decodificarBase64url(valor) {
  const base64 = valor
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    (char) => char.charCodeAt(0)
  );
}

async function assinar(valor, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const assinatura = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(valor)
  );

  return base64url(new Uint8Array(assinatura));
}

async function validarAssinatura(valor, assinatura, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    decodificarBase64url(assinatura),
    new TextEncoder().encode(valor)
  );
}

function obterCookie(request, nome) {
  const cookies = request.headers.get("Cookie") || "";

  for (const item of cookies.split(";")) {
    const [chave, ...valor] = item.trim().split("=");

    if (chave === nome) {
      return valor.join("=");
    }
  }

  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const stateRecebido = url.searchParams.get("state");
  const stateCookie = obterCookie(request, "discord_oauth_state");

  const limparState =
    "discord_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

  if (!env.SESSION_SECRET) {
    return Response.json(
      { ok: false, error: "missing_session_secret" },
      { status: 500 }
    );
  }

  if (!stateRecebido || !stateCookie) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?auth_error=invalid_state",
        "Set-Cookie": limparState
      }
    });
  }

  const [stateOriginal, assinaturaState] = stateCookie.split(".");

  let stateValido = false;

  try {
    stateValido =
      stateOriginal === stateRecebido &&
      await validarAssinatura(
        stateOriginal,
        assinaturaState,
        env.SESSION_SECRET
      );
  } catch {
    stateValido = false;
  }

  if (!stateValido) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?auth_error=invalid_state",
        "Set-Cookie": limparState
      }
    });
  }

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?auth_error=" + encodeURIComponent(error || "missing_code"),
        "Set-Cookie": limparState
      }
    });
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DB) {
    return Response.json(
      { ok: false, error: "missing_configuration" },
      { status: 500 }
    );
  }

  const redirectUri = new URL(
    "/api/auth/discord/callback",
    url.origin
  ).href;

  try {
    const tokenRes = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri
        })
      }
    );

    if (!tokenRes.ok) {
      console.error("Falha na troca do código OAuth2:", tokenRes.status);

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/?auth_error=token_exchange_failed",
          "Set-Cookie": limparState,
          "Cache-Control": "no-store"
        }
      });
    }

    const tokenData = await tokenRes.json();

    const userRes = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    if (!userRes.ok) {
      console.error("Falha ao buscar usuário Discord:", userRes.status);

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/?auth_error=fetch_user_failed",
          "Set-Cookie": limparState,
          "Cache-Control": "no-store"
        }
      });
    }

    const discordUser = await userRes.json();

    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;

    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    await env.DB.prepare(
      `INSERT INTO discord_users
       (user_id, username, avatar, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       avatar = excluded.avatar,
       updated_at = CURRENT_TIMESTAMP`
    ).bind(userId, username, avatar).run();

    // Criação da sessão
    const sessionPayload = base64url(
      new TextEncoder().encode(
        JSON.stringify({ userId, username, avatar })
      )
    );

    const sessionSignature = await assinar(
      sessionPayload,
      env.SESSION_SECRET
    );

    // Cookie de autenticação
    const sessionCookie =
      `discord_session=${sessionPayload}.${sessionSignature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;

    // Redirecionamento e envio dos dois cookies separados
    const headers = new Headers();

    headers.set("Location", "/?login=success");
    headers.append("Set-Cookie", limparState);
    headers.append("Set-Cookie", sessionCookie);
    headers.set("Cache-Control", "no-store");

    return new Response(null, {
      status: 302,
      headers
    });

  } catch (err) {
    console.error("Erro no callback Discord:", err);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?auth_error=exception",
        "Set-Cookie": limparState,
        "Cache-Control": "no-store"
      }
    });
  }
}
