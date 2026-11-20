import { json, requireSameOrigin, route } from "../../_lib/http.js";
import { logout } from "../../_lib/session.js";

export const onRequest = route({
  async POST({ request, env }) {
    requireSameOrigin(request);
    return json({ ok: true }, 200, { "Set-Cookie": await logout(request, env) });
  },
});
