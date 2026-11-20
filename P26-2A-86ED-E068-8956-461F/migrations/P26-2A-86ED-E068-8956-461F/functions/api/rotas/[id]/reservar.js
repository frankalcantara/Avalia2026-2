import { erro, json } from "../../../_lib/http.js";
import { exigirUsuario } from "../../../_lib/sessao.js";
import { idValido, saidaJaPassou } from "../../../_lib/validacao.js";

export async function onRequestPost(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;

  const id = idValido(contexto.params.id);
  if (!id) return erro("Rota inválida.");
  const db = contexto.env.DB;

  const rota = await db
    .prepare("SELECT id, motorista_id, data, horario, vagas_livres, ativa FROM rotas WHERE id = ?")
    .bind(id)
    .first();
  if (!rota || !rota.ativa) return erro("Essa rota não está mais disponível.", 404);
  if (rota.motorista_id === usuario.id) return erro("Você é o motorista desta rota.", 400);
  if (saidaJaPassou(rota.data, rota.horario)) return erro("Essa carona já saiu.", 409);

  const existente = await db
    .prepare("SELECT 1 AS ok FROM reservas WHERE rota_id = ? AND passageiro_id = ?")
    .bind(id, usuario.id)
    .first();
  if (existente) return erro("Você já reservou uma vaga nesta rota.", 409);
  if (rota.vagas_livres <= 0) return erro("Não há mais vagas nesta rota.", 409);

  try {
    await db.batch([
      db
        .prepare("INSERT INTO reservas (rota_id, passageiro_id, criado_em) VALUES (?, ?, ?)")
        .bind(id, usuario.id, Math.floor(Date.now() / 1000)),
      db.prepare("UPDATE rotas SET vagas_livres = vagas_livres - 1 WHERE id = ? AND ativa = 1").bind(id),
    ]);
  } catch (falha) {
    const mensagem = String(falha?.message || falha);
    if (mensagem.includes("CHECK")) return erro("Não há mais vagas nesta rota.", 409);
    if (mensagem.includes("UNIQUE")) return erro("Você já reservou uma vaga nesta rota.", 409);
    return erro("Não foi possível reservar agora. Tente novamente.", 500);
  }

  const atual = await db.prepare("SELECT vagas_livres FROM rotas WHERE id = ?").bind(id).first();
  return json({ ok: true, vagas_livres: atual?.vagas_livres ?? 0 }, 201);
}

export async function onRequestDelete(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;

  const id = idValido(contexto.params.id);
  if (!id) return erro("Rota inválida.");
  const db = contexto.env.DB;

  const reserva = await db
    .prepare("SELECT 1 AS ok FROM reservas WHERE rota_id = ? AND passageiro_id = ?")
    .bind(id, usuario.id)
    .first();
  if (!reserva) return erro("Você não tem reserva nesta rota.", 404);

  await db.batch([
    db
      .prepare(
        `UPDATE rotas SET vagas_livres = vagas_livres + 1
          WHERE id = ? AND EXISTS (SELECT 1 FROM reservas WHERE rota_id = ? AND passageiro_id = ?)`
      )
      .bind(id, id, usuario.id),
    db.prepare("DELETE FROM reservas WHERE rota_id = ? AND passageiro_id = ?").bind(id, usuario.id),
  ]);

  return json({ ok: true });
}
