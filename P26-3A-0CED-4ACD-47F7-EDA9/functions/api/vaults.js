/**
 * GET /api/vaults?mode=classico|sombra
 * Calendário dos cofres (do lançamento até hoje) com o status de cada dia.
 */
import { modeConfig } from "../../src/game.js";
import { json, methodNotAllowed } from "../../src/http.js";
import { requireUser } from "../../src/session.js";
import { getVaults } from "../../src/stats.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(env, request);
  const mode = new URL(request.url).searchParams.get("mode") || "classico";
  modeConfig(mode);
  return json(await getVaults(env, user, mode));
}

export const onRequest = () => methodNotAllowed();
