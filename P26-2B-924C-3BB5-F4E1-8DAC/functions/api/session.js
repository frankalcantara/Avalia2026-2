import { json, route } from "../_lib/http.js";
import { sessionUser } from "../_lib/session.js";

export const onRequest = route({
  async GET({ request, env }) {
    return json({ user: await sessionUser(request, env) });
  },
});
