/**
 * GET /api/me
 * Devolve o usuário logado (user_id, nome e avatar do Discord) ou null.
 */
import { json, usuarioAtual } from "../../lib/servidor.js";

export async function onRequestGet({ request, env }) {
  const usuario = await usuarioAtual(env, request);
  return json({ ok: true, usuario: usuario || null, loginConfigurado: Boolean(env.DISCORD_CLIENT_ID) });
}
