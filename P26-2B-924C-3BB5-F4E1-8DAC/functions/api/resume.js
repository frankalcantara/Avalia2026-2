import { database, json, readJson, requireSameOrigin, route } from "../_lib/http.js";
import { findResume, saveResume, validateResume } from "../_lib/resume.js";
import { requireUser } from "../_lib/session.js";

export const onRequest = route({
  async GET({ request, env }) {
    const user = await requireUser(request, env);
    return json({ resume: await findResume(database(env), user.id) });
  },
  async PUT({ request, env }) {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const resume = validateResume(await readJson(request));
    await saveResume(database(env), user.id, resume);
    return json({ resume });
  },
});
