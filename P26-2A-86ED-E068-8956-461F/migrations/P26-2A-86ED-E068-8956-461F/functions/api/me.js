import { json } from "../_lib/http.js";
import { exigirUsuario } from "../_lib/sessao.js";

export async function onRequestGet(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;
  return json({ usuario });
}
