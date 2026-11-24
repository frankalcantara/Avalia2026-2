// GET /api/me — usuário da sessão ou null (200 nos dois casos).
import { json, route } from "../../src/http.js";
import { getSessionUser } from "../../src/auth.js";
import { toUserPublic } from "../../src/serialize.js";

export const onRequestGet = route(async ({ request, env }) => {
  const user = await getSessionUser(env, request);
  return json({ user: toUserPublic(user) });
});
