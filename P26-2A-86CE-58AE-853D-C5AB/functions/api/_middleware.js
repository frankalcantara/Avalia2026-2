function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const prefix = `${name}=`;
  const item = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const pathname = new URL(request.url).pathname;

  if (pathname.startsWith("/api/auth/")) {
    return context.next();
  }

  const token = getCookie(request, "sessao");
  if (!token) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!env.DB) {
    return Response.json({ error: "Banco de dados indisponível." }, { status: 500 });
  }

  try {
    const usuario = await env.DB.prepare(
      "SELECT discord_users.user_id, discord_users.username, discord_users.avatar FROM sessoes JOIN discord_users ON discord_users.user_id = sessoes.user_id WHERE sessoes.token = ? AND sessoes.expira_em > ? LIMIT 1"
    ).bind(token, new Date().toISOString()).first();

    if (!usuario) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    context.data.usuario = usuario;
    context.data.sessionToken = token;
    return context.next();
  } catch (error) {
    console.error("Session validation failed.");
    return Response.json({ error: "Falha ao validar a sessão." }, { status: 500 });
  }
}
