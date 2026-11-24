/**
 * GET /api/reivindicacoes (logado) → 200 { feitas: [Reivindicacao], recebidas: [Reivindicacao] }
 * feitas = as que o usuário abriu; recebidas = as feitas nos itens dele. Mais recentes primeiro
 * (atualizado_em), no máximo 200 de cada. O usuário é parte em todas, então os contatos vêm incluídos.
 */
import { exigirUsuario, json, porMetodo } from "../../_lib/http.js";
import { SELECT_REIVINDICACAO, serializarReivindicacao } from "../../_lib/repositorio.js";

const MAXIMO = 200;

async function listar(context) {
  const usuario = exigirUsuario(context);
  const { env } = context;
  const ordem = `ORDER BY r.atualizado_em DESC, r.id DESC LIMIT ?`;
  const [feitas, recebidas] = await env.DB.batch([
    env.DB.prepare(`${SELECT_REIVINDICACAO} WHERE r.reivindicante_id = ? ${ordem}`).bind(usuario.user_id, MAXIMO),
    env.DB.prepare(`${SELECT_REIVINDICACAO} WHERE i.autor_id = ? ${ordem}`).bind(usuario.user_id, MAXIMO),
  ]);
  const ser = (l) => serializarReivindicacao(l, usuario.user_id);
  return json({ feitas: feitas.results.map(ser), recebidas: recebidas.results.map(ser) });
}

export const onRequest = porMetodo({ GET: listar });
