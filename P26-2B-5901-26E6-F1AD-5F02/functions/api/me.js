import { getUser, json, unauthorized } from '../_lib.js';
export async function onRequestGet(ctx) {
  const u = await getUser(ctx);
  return u ? json(u) : unauthorized();
}
