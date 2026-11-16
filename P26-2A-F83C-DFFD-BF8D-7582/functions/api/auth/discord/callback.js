/**
 * Alias oficial exigido pelo modelo do professor: GET /api/auth/discord/callback
 * Preserva a query string (code/state) e encaminha para o handler canônico.
 */
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = new URL('/api/auth/callback', url.origin);
  target.search = url.search;
  return Response.redirect(target.toString(), 302);
}
