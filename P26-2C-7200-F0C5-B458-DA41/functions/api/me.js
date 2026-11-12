/** GET /api/me — usuário logado (ou null) e metadados que a interface precisa. */
import { getSessionUser } from "../_lib/session.js";
import { json } from "../_lib/http.js";
import { STATUSES, SEVERITIES, TRANSITIONS, CHAVE_UNICA } from "../_lib/rules.js";

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env).catch(() => null);
  return json({
    ok: true,
    user,
    chave: CHAVE_UNICA,
    statuses: STATUSES,
    severities: SEVERITIES,
    transitions: TRANSITIONS,
    discordConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    d1Bound: Boolean(env.DB),
  });
}
