/**
 * GET /api/ranking?mode=&scope=global|guild&guild=<id>&sort=wins|streak
 * Ranking global ou do servidor do Discord (só partidas jogadas no próprio dia).
 */
import { modeConfig } from "../../src/game.js";
import { json, methodNotAllowed } from "../../src/http.js";
import { requireUser } from "../../src/session.js";
import { getRanking } from "../../src/stats.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(env, request);
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") || "classico";
  modeConfig(mode);
  return json(await getRanking(env, user, {
    mode,
    scope: params.get("scope") || "global",
    guildId: params.get("guild"),
    sort: params.get("sort") === "streak" ? "streak" : "wins",
  }));
}

export const onRequest = () => methodNotAllowed();
