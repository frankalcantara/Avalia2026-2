import { json, erroInterno } from "../_lib/http.js";
import { usuarioDaSessao } from "../_lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    const u = await usuarioDaSessao(env, request);
    return json({ user: u ? { id: u.id, username: u.username, avatar_url: u.avatar_url } : null });
  } catch (e) {
    return erroInterno(e);
  }
}
