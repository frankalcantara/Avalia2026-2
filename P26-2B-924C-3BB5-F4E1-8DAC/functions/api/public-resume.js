import { database, json, RequestError, route } from "../_lib/http.js";
import { DISCORD_ID, findResume } from "../_lib/resume.js";

export const onRequest = route({
  async GET({ request, env }) {
    const userId = new URL(request.url).searchParams.get("user");
    if (!userId || !DISCORD_ID.test(userId)) throw new RequestError("Informe um ID de currículo válido.");
    const resume = await findResume(database(env), userId, true);
    if (!resume) throw new RequestError("Currículo público indisponível.", 404);
    return json({ resume });
  },
});
