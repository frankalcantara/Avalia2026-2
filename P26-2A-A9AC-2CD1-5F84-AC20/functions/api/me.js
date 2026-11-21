import { json, requireUser, avatarUrl, CATEGORIES } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const { id, username } = auth.user;
  return json({ user: { id, username, avatar_url: avatarUrl(auth.user) }, categories: CATEGORIES });
}
