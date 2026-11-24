import { fail, json, methodNotAllowed } from "../_lib/http.js";
import { inviteUrl } from "../_lib/invite.js";
import { hasTtsKey } from "../_lib/tts.js";
import { getSessionUser } from "../_lib/session.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  const url = inviteUrl(env);
  let show = false;
  if (url) {
    try {
      const row = await env.DB.prepare("SELECT invite_prompt_seen_at AS seen FROM discord_users WHERE user_id = ?")
        .bind(user.userId).first();
      show = !!row && row.seen === null;
    } catch {
      show = false; // coluna ausente / D1 indisponível: não derruba o /api/me
    }
  }
  return json({ ok: true, user, invitePrompt: { show, url }, tts: hasTtsKey(env) });
}
