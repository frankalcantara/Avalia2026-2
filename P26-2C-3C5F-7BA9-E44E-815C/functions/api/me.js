import { json, currentUser } from "../../lib/util.js";

export async function onRequestGet({ request, env }) {
  return json({ user: await currentUser(request, env) });
}
