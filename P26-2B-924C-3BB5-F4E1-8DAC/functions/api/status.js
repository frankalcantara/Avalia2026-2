import { database, json, route } from "../_lib/http.js";

export const onRequest = route({
  async GET({ env }) {
    await database(env).prepare("SELECT user_id FROM resumes LIMIT 0").all();
    return json({ ok: true, projectId: 39 });
  },
});
