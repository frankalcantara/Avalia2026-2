/**
 * Cloudflare Pages Function — GET /api/status
 * Diagnóstico de saúde da aplicação, conectividade D1, configuração Discord OAuth2 e estatísticas agregadas.
 */
import { getSessionUser } from "../../src/server/auth.js";
import { ensureSchema } from "../../src/server/db.js";
import { jsonResponse } from "../../src/server/http.js";

const CHAVE_PROJETO = "P26-2B-0018-0402-94DD-FCB7";
const PROJECT_ID = 30;
const PROJECT_TITLE = "Jukebox e Playlists Colaborativas de Links";

export async function onRequestGet(context) {
  const { request, env } = context;

  let d1Connected = false;
  const stats = { rooms: 0, tracks: 0, votes: 0 };

  if (env?.DB) {
    try {
      await ensureSchema(env.DB);
      const [roomsRow, tracksRow, votesRow] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total FROM rooms").first(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM tracks").first(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM track_votes").first(),
      ]);

      stats.rooms = Number(roomsRow?.total || 0);
      stats.tracks = Number(tracksRow?.total || 0);
      stats.votes = Number(votesRow?.total || 0);
      d1Connected = true;
    } catch {
      d1Connected = false;
    }
  }

  const sessionUser = d1Connected ? await getSessionUser(request, env) : null;

  return jsonResponse({
    ok: true,
    chave: CHAVE_PROJETO,
    projectId: PROJECT_ID,
    projectTitle: PROJECT_TITLE,
    d1Connected,
    discordOAuthConfigured: Boolean(env?.DISCORD_CLIENT_ID && env?.DISCORD_CLIENT_SECRET),
    sessionUser,
    stats,
    serverTimestamp: new Date().toISOString(),
  });
}
