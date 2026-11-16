/**
 * POST /api/challenge { word }  cria um desafio com palavra validada no dicionário
 * GET  /api/challenge           lista os desafios criados pelo usuário
 */
import { createChallenge, listChallenges } from "../../../src/challenge.js";
import { json, methodNotAllowed, readJson } from "../../../src/http.js";
import { requireUser } from "../../../src/session.js";

export async function onRequestPost({ request, env }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  return json(await createChallenge(env, user, body.word), 201);
}

export async function onRequestGet({ request, env }) {
  const user = await requireUser(env, request);
  return json(await listChallenges(env, user));
}

export const onRequest = () => methodNotAllowed();
