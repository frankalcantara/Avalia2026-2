import { BADGES } from "../_lib/badges.js";

export async function onRequestGet() {
  const badges = Object.entries(BADGES).map(([key, label]) => ({ key, label }));
  return Response.json({ badges });
}
