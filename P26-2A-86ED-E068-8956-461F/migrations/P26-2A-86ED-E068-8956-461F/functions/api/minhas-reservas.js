import { json } from "../_lib/http.js";
import { exigirUsuario } from "../_lib/sessao.js";
import { hojeSP } from "../_lib/validacao.js";

export async function onRequestGet(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;

  const { results } = await contexto.env.DB
    .prepare(
      `SELECT r.id, r.origem, r.destino, r.data, r.horario, r.vagas_totais, r.vagas_livres,
              u.id AS motorista_id, u.nome AS motorista_nome, u.username AS motorista_username,
              u.avatar_url AS motorista_avatar
         FROM reservas p
         JOIN rotas r ON r.id = p.rota_id
         JOIN usuarios u ON u.id = r.motorista_id
        WHERE p.passageiro_id = ? AND r.ativa = 1 AND r.data >= ?
        ORDER BY r.data ASC, r.horario ASC`
    )
    .bind(usuario.id, hojeSP())
    .all();

  return json({ reservas: results });
}
