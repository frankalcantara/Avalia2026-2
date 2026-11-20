import { erro, json } from "../../../_lib/http.js";
import { exigirUsuario } from "../../../_lib/sessao.js";
import { idValido } from "../../../_lib/validacao.js";

export async function onRequestDelete(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;

  const id = idValido(contexto.params.id);
  if (!id) return erro("Rota inválida.");

  const resultado = await contexto.env.DB
    .prepare("UPDATE rotas SET ativa = 0 WHERE id = ? AND motorista_id = ? AND ativa = 1")
    .bind(id, usuario.id)
    .run();

  if (resultado.meta.changes === 0) return erro("Rota não encontrada ou não é sua.", 404);
  return json({ ok: true });
}
