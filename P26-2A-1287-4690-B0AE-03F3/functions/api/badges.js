import { json } from '../_lib/http.js';
import { BADGES } from '../_lib/badges.js';

export async function onRequestGet() {
  return json({ badges: BADGES.map(({ id, label, emoji }) => ({ id, label, emoji })) });
}
