/**
 * POST /api/guess  { mode, date, guess }
 * Valida o chute no servidor (formato, dicionário, data e limite de tentativas),
 * calcula o retorno, grava no D1 e consolida as estatísticas ao final.
 */
import { resolveGameDate } from "../../src/dates.js";
import { modeConfig, submitGuess } from "../../src/game.js";
import { json, methodNotAllowed, readJson } from "../../src/http.js";
import { requireUser } from "../../src/session.js";

export async function onRequestPost({ request, env }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const mode = typeof body.mode === "string" ? body.mode : "classico";
  modeConfig(mode);
  const date = resolveGameDate(body.date);
  return json(await submitGuess(env, user, mode, date, body.guess));
}

export const onRequest = () => methodNotAllowed();
