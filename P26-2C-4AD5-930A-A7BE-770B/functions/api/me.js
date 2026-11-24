function getSessionId(request) {
  const cookies = request.headers.get("Cookie") || "";
  const cookie = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("discord_session="));
  const sessionId = cookie ? cookie.slice("discord_session=".length) : "";
  return /^[a-f0-9]{64}$/i.test(sessionId) ? sessionId : null;
}

export async function onRequestGet({ request, env }) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!env.DB) {
    console.error("User session lookup failed: D1 binding is not configured.");
    return Response.json({ error: "database_unavailable" }, { status: 500 });
  }

  try {
    const user = await env.DB.prepare(
      "SELECT discord_users.user_id, discord_users.username, discord_users.avatar FROM sessions INNER JOIN discord_users ON discord_users.user_id = sessions.user_id WHERE sessions.id = ? AND datetime(sessions.expires_at) > CURRENT_TIMESTAMP LIMIT 1"
    ).bind(sessionId).first();

    if (!user) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    return Response.json({
      user_id: user.user_id,
      username: user.username,
      avatar: user.avatar,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("User session lookup failed:", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
