import { fail, json, methodNotAllowed, requireDatabase } from "../_utils.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");
  try {
    const db = requireDatabase(env);
    await db.prepare("SELECT 1 AS ok").first();
    return json({ ok: true, d1Connected: true });
  } catch (error) {
    return fail(error);
  }
}
