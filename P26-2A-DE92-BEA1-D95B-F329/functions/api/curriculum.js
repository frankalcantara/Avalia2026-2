import { emptyCurriculum, HttpError, json, loadCurriculum, methodAllowed, readJson, requireCsrf, requireDb, requireSession, saveCurriculum, validateCurriculum, withErrors } from "../_lib.js";
export const onRequest = withErrors(async ({ request, env }) => {
  methodAllowed(request, ["GET", "PUT"]);
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.has("user")) {
    const userId = url.searchParams.get("user");
    if (!/^\d{5,25}$/.test(userId || "")) throw new HttpError(400, "invalid_user", "O endereço do currículo é inválido.");
    const curriculum = await loadCurriculum(requireDb(env), userId, { publicOnly: true });
    if (!curriculum) throw new HttpError(404, "curriculum_not_found", "Este currículo não foi publicado ou não está disponível.");
    return json({ curriculum });
  }
  const session = await requireSession(request, env);
  const db = requireDb(env);
  if (request.method === "GET") {
    const curriculum = await loadCurriculum(db, session.user.user_id);
    return json({ curriculum: curriculum || emptyCurriculum(session.user) });
  }
  requireCsrf(request, session);
  const curriculum = validateCurriculum(await readJson(request));
  return json({ curriculum: await saveCurriculum(db, session.user.user_id, curriculum) });
});
