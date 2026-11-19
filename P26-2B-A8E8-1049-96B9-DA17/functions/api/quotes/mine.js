import { fail, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { extraFilters, listQuotes } from "../../_lib/list.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  const url = new URL(request.url);
  const vis = url.searchParams.get("visibility") || "all";
  if (!["all", "public", "private"].includes(vis)) {
    return fail(400, "Parâmetro inválido.", { visibility: "Use all, public ou private." });
  }
  const where = ["q.user_id = ?"];
  const params = [user.userId];
  if (vis !== "all") { where.push("q.is_public = ?"); params.push(vis === "public" ? 1 : 0); }
  const f = extraFilters(url, where, params);
  if (f.response) return f.response;
  return listQuotes(env, url, where, params, user.userId);
}
