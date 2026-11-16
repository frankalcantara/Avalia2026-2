/**
 * GET /api/challenge/:id
 * Criador vê quem jogou; jogador recebe o próprio estado (sem a palavra até terminar).
 */
import { getChallenge } from "../../../src/challenge.js";
import { json, methodNotAllowed } from "../../../src/http.js";
import { requireUser } from "../../../src/session.js";

export async function onRequestGet({ request, env, params }) {
  const user = await requireUser(env, request);
  return json(await getChallenge(env, user, params.id));
}

export const onRequest = () => methodNotAllowed();
