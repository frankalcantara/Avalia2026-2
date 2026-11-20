function getSessionId(request) {
  const cookies = request.headers.get("Cookie") || "";
  const cookie = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("discord_session="));
  const sessionId = cookie ? cookie.slice("discord_session=".length) : "";
  return /^[a-f0-9]{64}$/i.test(sessionId) ? sessionId : null;
}

export async function onRequestPost({ request, env }) {
  const sessionId = getSessionId(request);
  let status = 204;

  if (sessionId) {
    if (!env.DB) {
      console.error("Session logout failed: D1 binding is not configured.");
      status = 500;
    } else {
      try {
        await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
      } catch (error) {
        console.error("Session logout failed:", error);
        status = 500;
      }
    }
  }

  return new Response(null, {
    status,
    headers: {
      "Set-Cookie": "discord_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
