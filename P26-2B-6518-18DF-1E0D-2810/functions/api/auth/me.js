import { authenticate, json, requireDatabase } from "../../_shared.js";

export async function onRequestGet(context) {
  const unavailable = requireDatabase(context.env);
  if (unavailable) return unavailable;
  const auth = await authenticate(context);
  if (auth.response) return auth.response;
  return json({ ok: true, user: auth.user });
}