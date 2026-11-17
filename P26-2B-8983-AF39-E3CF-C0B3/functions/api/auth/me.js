import { fail, json, methodNotAllowed, readSession } from "../../_utils.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed("GET");
  try {
    return json({ user: await readSession(context.request, context.env) });
  } catch (error) {
    return fail(error);
  }
}
