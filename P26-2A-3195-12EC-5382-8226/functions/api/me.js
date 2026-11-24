/** GET /api/me — perfil do usuário logado (user_id, nome e avatar importados do Discord). */
import { json, error } from "../../src/lib/http.js";

export async function onRequestGet({ data }) {
  const u = data.user;
  if (!u) return error(401, "Faça login com o Discord.");
  return json({
    ok: true,
    user: {
      userId: u.user_id,
      username: u.username,
      displayName: u.display_name || u.username,
      avatarUrl: u.avatar_url,
    },
  });
}
