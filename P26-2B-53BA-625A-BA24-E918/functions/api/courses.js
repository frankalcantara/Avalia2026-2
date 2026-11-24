import { requireDB } from "../_lib/auth.js";
import { errorResponse, json, methodNotAllowed } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  try {
    const db = requireDB(env);
    const result = await db.prepare("SELECT code, title FROM courses ORDER BY title, code").all();
    return json({ courses: result.results || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest({ request }) {
  return methodNotAllowed(["GET"]);
}
