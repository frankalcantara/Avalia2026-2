import { getSession, json, methodNotAllowed } from "../../_shared/auth.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed("GET");
  try {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Autenticação necessária." }, 401);
    return json({
      authenticated: true,
      user: {
        id: user.user_id,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Discord session lookup failed.", error);
    return json({ error: "Autenticação não configurada." }, 500);
  }
}
