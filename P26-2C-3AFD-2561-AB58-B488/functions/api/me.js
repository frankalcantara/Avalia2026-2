import { requireUser, json } from '../_lib/auth.js';

export async function onRequestGet(ctx) {
  const { user, response } = await requireUser(ctx);
  return response ?? json({ user });
}
