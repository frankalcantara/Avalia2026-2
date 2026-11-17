import { buildCookie, isSameOrigin, SESSION_COOKIE } from "../../_utils.js";

/**
 * /api/auth/logout — encerra a sessao removendo o cookie.
 * Somente POST (um link GET de outro site nao consegue deslogar o usuario).
 */
export async function onRequestPost(context) {
  if (!isSameOrigin(context.request)) {
    return new Response("Origem não permitida.", { status: 403 });
  }
  const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, "", { maxAge: 0 }));
  return new Response(null, { status: 302, headers });
}
