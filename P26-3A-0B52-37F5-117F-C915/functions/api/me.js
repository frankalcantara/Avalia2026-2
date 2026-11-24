import { getSession, json } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  return json({ user: await getSession(request, env) });
}
