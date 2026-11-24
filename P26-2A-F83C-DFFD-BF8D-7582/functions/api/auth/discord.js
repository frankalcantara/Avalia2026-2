/**
 * Alias oficial exigido pelo modelo do professor: GET /api/auth/discord
 * Encaminha para o handler canônico de login OAuth2.
 */
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/api/auth/login`, 302);
}
