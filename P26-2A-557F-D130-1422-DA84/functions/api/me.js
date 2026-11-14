import { json, autenticar } from "../../lib/util.js";

export async function onRequestGet({ request, env }) {
  const { u, erro } = await autenticar(request, env);
  return erro || json(u);
}
