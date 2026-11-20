
/**
 * Cloudflare Pages Function — /api/status
 * Verifica a sessão Discord e a conectividade com o Cloudflare D1.
 */

function base64urlParaBytes(valor) {
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
    base64urlParaBytes(assinatura),
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

async function obterSessao(request, env) {
  if (!env.SESSION_SECRET) {
    return null;
  }

  const cookie = obterCookie(request, "discord_session");

  if (!cookie) {
    return null;
  }

  const separador = cookie.lastIndexOf(".");

  if (separador === -1) {
    return null;
  }

  const payload = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);

  try {
    const assinaturaValida = await validarAssinatura(
      payload,
      assinatura,
      env.SESSION_SECRET
    );

    if (!assinaturaValida) {
      return null;
    }

    const bytes = base64urlParaBytes(payload);
    const json = new TextDecoder().decode(bytes);
    const usuario = JSON.parse(json);

    if (!usuario.userId || !usuario.username) {
      return null;
    }

    return usuario;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  const chave = "P26-2C-FBCF-D7E5-0BE4-6F25";
  const projectId = 2;
  const projectTitle = "Clone do Termo (Wordle) Diário";

  const sessionUser = await obterSessao(request, env);

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;
    let ultimosRegistros = [];

    if (env.DB) {
      try {
        const countRow = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM project_records"
        ).first();

        const listRes = await env.DB.prepare(
          "SELECT id, user_id, username, conteudo, created_at FROM project_records ORDER BY id DESC LIMIT 10"
        ).all();

        dbConnected = true;
        totalRegistros = Number(countRow?.total || 0);
        ultimosRegistros = listRes.results || [];
      } catch {
        dbConnected = false;
      }
    }

    return Response.json({
      ok: true,
      chave,
      projectId,
      projectTitle,
      d1Connected: dbConnected,
      discordOAuthConfigured: Boolean(
        env.DISCORD_CLIENT_ID &&
        env.DISCORD_CLIENT_SECRET &&
        env.SESSION_SECRET
      ),
      sessionUser,
      totalRegistros,
      ultimosRegistros,
      serverTimestamp: new Date().toISOString()
    });
  }

  if (request.method === "POST") {
    if (!sessionUser) {
      return Response.json(
        { ok: false, error: "Autenticação necessária." },
        { status: 401 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { ok: false, error: "JSON inválido." },
        { status: 400 }
      );
    }

    const conteudo = String(body.conteudo || "")
      .trim()
      .slice(0, 500);

    if (!conteudo) {
      return Response.json(
        { ok: false, error: "Conteúdo obrigatório." },
        { status: 400 }
      );
    }

    if (!env.DB) {
      return Response.json(
        { ok: false, error: "Banco de dados indisponível." },
        { status: 503 }
      );
    }

    try {
      await env.DB.prepare(
        "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
      ).bind(
        sessionUser.userId,
        sessionUser.username,
        chave,
        conteudo
      ).run();

      return Response.json({
        ok: true,
        saved: true,
        chave,
        serverTimestamp: new Date().toISOString()
      }, { status: 201 });
    } catch {
      return Response.json(
        { ok: false, error: "Falha ao salvar no banco de dados." },
        { status: 500 }
      );
    }
  }

  return Response.json(
    { ok: false, error: "Method not allowed" },
    { status: 405 }
  );
}
