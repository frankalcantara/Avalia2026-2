import { json } from "../_lib/http.js";
import { exigirUsuario } from "../_lib/sessao.js";
import { hojeSP } from "../_lib/validacao.js";

export async function onRequestGet(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;
  const db = contexto.env.DB;
  const hoje = hojeSP();

  const { results: rotas } = await db
    .prepare(
      `SELECT id, origem, destino, data, horario, vagas_totais, vagas_livres
         FROM rotas
        WHERE motorista_id = ? AND ativa = 1 AND data >= ?
        ORDER BY data ASC, horario ASC`
    )
    .bind(usuario.id, hoje)
    .all();

  const { results: passageiros } = await db
    .prepare(
      `SELECT p.rota_id, u.id AS discord_id, u.username, u.nome, u.avatar_url
         FROM reservas p
         JOIN usuarios u ON u.id = p.passageiro_id
        WHERE p.rota_id IN (SELECT id FROM rotas WHERE motorista_id = ? AND ativa = 1 AND data >= ?)
        ORDER BY p.criado_em ASC`
    )
    .bind(usuario.id, hoje)
    .all();

  const porRota = new Map();
  for (const passageiro of passageiros) {
    if (!porRota.has(passageiro.rota_id)) porRota.set(passageiro.rota_id, []);
    porRota.get(passageiro.rota_id).push({
      discord_id: passageiro.discord_id,
      username: passageiro.username,
      nome: passageiro.nome,
      avatar_url: passageiro.avatar_url,
    });
  }

  return json({ rotas: rotas.map((r) => ({ ...r, passageiros: porRota.get(r.id) || [] })) });
}
