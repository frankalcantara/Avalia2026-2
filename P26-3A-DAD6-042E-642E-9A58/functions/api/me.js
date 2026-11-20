import { requireUser } from "../_shared/auth.js";
import { avatarUrl } from "../_shared/discord.js";
import { handle, json, methodNotAllowed } from "../_shared/http.js";

// GET /api/me
export const onRequestGet = handle("me", async ({ request, env }) => {
  const user = await requireUser(request, env);
  return json(200, {
    user_id: user.user_id,
    username: user.username,
    global_name: user.global_name ?? null,
    avatar_url: avatarUrl(user.user_id, user.avatar ?? null),
  });
});

export function onRequest() {
  return methodNotAllowed("GET");
}
