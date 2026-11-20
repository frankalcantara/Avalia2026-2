import { erro, json, lerCorpoJson } from "../../_lib/http.js";
import { exigirUsuario } from "../../_lib/sessao.js";
import { agoraSP, escaparLike, hojeSP, limparTexto, validarRota } from "../../_lib/validacao.js";

const LIMITE_ROTAS_ATIVAS_POR_MOTORISTA = 10;

export async function onRequestGet(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;

  const consulta = new URL(contexto.request.url).searchParams;
  const dataParam = consulta.get("data");
  const data = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? dataParam : hojeSP();
  const origem = limparTexto(consulta.get("origem") || "", 1, 60);
  const destino = limparTexto(consulta.get("destino") || "", 1, 60);
  const padraoOrigem = origem ? `%${escaparLike(origem)}%` : "%";
  const padraoDestino = destino ? `%${escaparLike(destino)}%` : "%";

  const { results } = await contexto.env.DB
    .prepare(
      `SELECT r.id, r.origem, r.destino, r.data, r.horario, r.vagas_totais, r.vagas_livres, r.motorista_id,
              u.nome AS motorista_nome, u.username AS motorista_username, u.avatar_url AS motorista_avatar,
              EXISTS(SELECT 1 FROM reservas x WHERE x.rota_id = r.id AND x.passageiro_id = ?) AS ja_reservei
         FROM rotas r JOIN usuarios u ON u.id = r.motorista_id
        WHERE r.ativa = 1
          AND r.data = ?
          AND (r.data || ' ' || r.horario) >= ?
          AND r.origem LIKE ? ESCAPE '\\'
          AND r.destino LIKE ? ESCAPE '\\'
        ORDER BY r.horario ASC, r.id ASC
        LIMIT 100`
    )
    .bind(usuario.id, data, agoraSP(), padraoOrigem, padraoDestino)
    .all();

  const rotas = results.map((r) => ({
    ...r,
    ja_reservei: Boolean(r.ja_reservei),
    sou_motorista: r.motorista_id === usuario.id,
  }));
  return json({ data, rotas });
}

export async function onRequestPost(contexto) {
  const { usuario, resposta } = await exigirUsuario(contexto);
  if (resposta) return resposta;

  const corpo = await lerCorpoJson(contexto.request);
  if (!corpo) return erro("Corpo da requisição inválido.");

  const validacao = validarRota(corpo);
  if (!validacao.ok) return json({ erro: validacao.erros[0], erros: validacao.erros }, 400);
  const { origem, destino, data, horario, vagas } = validacao.valores;

  const ativas = await contexto.env.DB
    .prepare("SELECT COUNT(*) AS total FROM rotas WHERE motorista_id = ? AND ativa = 1 AND (data || ' ' || horario) >= ?")
    .bind(usuario.id, agoraSP())
    .first();
  if (ativas.total >= LIMITE_ROTAS_ATIVAS_POR_MOTORISTA) {
    return erro(`Você já tem ${LIMITE_ROTAS_ATIVAS_POR_MOTORISTA} rotas ativas. Cancele uma para criar outra.`, 409);
  }

  const resultado = await contexto.env.DB
    .prepare(
      `INSERT INTO rotas (motorista_id, origem, destino, data, horario, vagas_totais, vagas_livres, ativa, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(usuario.id, origem, destino, data, horario, vagas, vagas, Math.floor(Date.now() / 1000))
    .run();

  return json({ ok: true, id: resultado.meta.last_row_id }, 201);
}
