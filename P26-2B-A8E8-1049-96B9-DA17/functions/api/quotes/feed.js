import { fail, methodNotAllowed } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { extraFilters, listQuotes } from "../../_lib/list.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const user = await getSessionUser(request, env);
  if (!user) return fail(401, "Não autenticado.");
  const url = new URL(request.url);
  const where = ["q.is_public = 1"];
  const params = [];
  // No feed público só vale ?tag=; ?collection= é privado e ignorado.
  const tagOnly = new URL(url); tagOnly.searchParams.delete("collection");
  const f = extraFilters(tagOnly, where, params);
  if (f.response) return f.response;
  return listQuotes(env, url, where, params, user.userId);
}
