import {
  clearOAuthStateCookie,
  clearSessionCookie,
} from "../../_lib/session.js";

export async function onRequestPost(context) {
  const { request } = context;
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  headers.append("Set-Cookie", clearSessionCookie(request));
  headers.append("Set-Cookie", clearOAuthStateCookie(request));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
