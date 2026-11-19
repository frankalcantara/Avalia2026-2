import { requireUser } from "../../../lib/auth.js";

export async function onRequestGet(context) {
  const error = requireUser(context);
  if (error) return error;

  return Response.json({ data: context.data.user }, {
    headers: { "Cache-Control": "no-store" },
  });
}
