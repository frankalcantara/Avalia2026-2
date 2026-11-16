/**
 * GET /api/stats?mode=classico|sombra
 * Estatísticas consolidadas: vitórias, streak e distribuição de tentativas.
 */
import { modeConfig } from "../../src/game.js";
import { json, methodNotAllowed } from "../../src/http.js";
import { requireUser } from "../../src/session.js";
import { getStats } from "../../src/stats.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(env, request);
  const mode = new URL(request.url).searchParams.get("mode") || "classico";
  modeConfig(mode);
  return json(await getStats(env, user, mode));
}

export const onRequest = () => methodNotAllowed();
