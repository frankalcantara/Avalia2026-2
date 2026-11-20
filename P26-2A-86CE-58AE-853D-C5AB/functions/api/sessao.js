export async function onRequestGet(context) {
  const { user_id, username, avatar } = context.data.usuario;
  return Response.json({ user_id, username, avatar });
}

export async function onRequestDelete(context) {
  const { env, data } = context;
  await env.DB.prepare(
    "DELETE FROM sessoes WHERE token = ? AND user_id = ?"
  ).bind(data.sessionToken, data.usuario.user_id).run();

  const response = new Response(null, { status: 204 });
  response.headers.append(
    "Set-Cookie",
    "sessao=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  response.headers.append(
    "Set-Cookie",
    "discord_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  return response;
}
