/**
 * POST /api/challenge/:id/guess { guess }
 * Chute no desafio, validado no servidor. O criador não pode jogar o próprio desafio.
 */
import { guessChallenge } from "../../../../src/challenge.js";
import { json, methodNotAllowed, readJson } from "../../../../src/http.js";
import { requireUser } from "../../../../src/session.js";

export async function onRequestPost({ request, env, params }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  return json(await guessChallenge(env, user, params.id, body.guess));
}

export const onRequest = () => methodNotAllowed();
