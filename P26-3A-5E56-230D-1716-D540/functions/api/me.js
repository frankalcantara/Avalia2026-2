/** GET /api/me → 200 { usuario: { user_id, username, nome_exibicao, avatar_url } | null } */
import { json, porMetodo } from "../_lib/http.js";

export const onRequest = porMetodo({
  GET: async ({ data }) => json({ usuario: data.usuario || null }),
});
