/**
 * GET /api/game?mode=classico|sombra&date=AAAA-MM-DD
 * Estado da partida do usuário. A resposta só é enviada quando a partida termina.
 */
import { resolveGameDate } from "../../src/dates.js";
import { getGameState, modeConfig } from "../../src/game.js";
import { json, methodNotAllowed } from "../../src/http.js";
import { requireUser } from "../../src/session.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(env, request);
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") || "classico";
  modeConfig(mode);
  const date = resolveGameDate(params.get("date"));
  return json(await getGameState(env, user, mode, date));
}

export const onRequest = () => methodNotAllowed();
