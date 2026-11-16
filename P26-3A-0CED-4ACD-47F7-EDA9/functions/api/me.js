/**
 * GET /api/me
 * Usuário autenticado (dados importados do Discord) e seus servidores.
 */
import { LAUNCH_DATE } from "../../src/config.js";
import { today } from "../../src/dates.js";
import { json, methodNotAllowed } from "../../src/http.js";
import { requireUser } from "../../src/session.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(env, request);
  const { results } = await env.DB.prepare(
    "SELECT guild_id, guild_name, guild_icon FROM user_guilds WHERE user_id = ? ORDER BY guild_name COLLATE NOCASE"
  ).bind(user.id).all();
  return json({
    user,
    guilds: results.map((g) => ({ id: g.guild_id, name: g.guild_name, icon: g.guild_icon })),
    today: today(),
    launchDate: LAUNCH_DATE,
  });
}

export const onRequest = () => methodNotAllowed();
